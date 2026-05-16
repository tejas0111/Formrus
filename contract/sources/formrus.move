module formrus::registry {
    use std::string::{Self, String};
    use std::type_name;
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::vec_set::{Self, VecSet};

    // ── Error codes ──────────────────────────────────────────────

    const E_NOT_CREATOR: u64 = 1;
    const E_FORM_PAUSED: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 9;

    const E_INSUFFICIENT_POOL: u64 = 5;
    const E_ELIGIBILITY_REQUIRED: u64 = 6;
    const E_ELIGIBILITY_TYPE: u64 = 7;
    const E_ELIGIBILITY_BALANCE: u64 = 8;
    const E_DNA_ALREADY_REGISTERED: u64 = 10;
    const E_INVALID_ACTION: u64 = 12;
    const E_EMPTY_DNA: u64 = 13;
    const E_EMPTY_SCHEMA: u64 = 14;
    const E_EMPTY_RESPONSE: u64 = 15;
    const E_BLOB_ID_TOO_LONG: u64 = 21;
    const E_FORM_EXPIRED: u64 = 16;
    const E_SUBMISSION_LIMIT: u64 = 17;
    const E_REWARD_LOCKED: u64 = 18;
    const E_FORM_DRAINED: u64 = 19;
    const E_INVALID_LIMITS: u64 = 22;
    const E_NO_PENDING_CREATOR: u64 = 23;
    const E_NOT_PENDING_CREATOR: u64 = 24;
    const E_DRAIN_NOT_READY: u64 = 25;
    const E_INVALID_ELIGIBILITY_KIND: u64 = 26;

    // ── Constants ────────────────────────────────────────────────

    const ACTION_NONE: u8 = 0;
    const ACTION_PAY_REWARD: u8 = 1;

    const ELIGIBILITY_ANYONE: u8 = 0;
    const ELIGIBILITY_MIN_SUI: u8 = 1;
    const ELIGIBILITY_COIN: u8 = 2;
    const ELIGIBILITY_OBJECT: u8 = 3;
    const MAX_BLOB_ID_LEN: u64 = 256;
    const DRAIN_DELAY_MS: u64 = 3_600_000; // 1 hour
    const MAX_ROLE_MEMBERS: u64 = 50;

    // ── Shared objects ───────────────────────────────────────────

    public struct Registry has key {
        id: UID,
        forms_created: u64,
        registered_dnas: Table<vector<u8>, bool>,
        dna_to_form_id: Table<vector<u8>, address>,
    }

    public struct Form has key {
        id: UID,
        creator: address,
        dna: vector<u8>,
        schema_blob_id: String,
        action_type: u8,
        reward_amount: u64,
        eligibility_kind: u8,
        eligibility_amount: u64,
        eligibility_type: String,
        created_at_ms: u64,
        expires_at_ms: u64,
        active: bool,
        drained: bool,
        fee_pool: Balance<SUI>,
        submission_count: u64,
        submitters: Table<address, u64>,
        max_submissions_per_address: u64,
        max_total_submissions: u64, // 0 = unlimited
        reward_locked: bool,
        schema_version: u64,
        pending_creator: std::option::Option<address>,
        drain_after_ms: u64,
        admins: VecSet<address>,
        viewers: VecSet<address>,
        }

    // ── Events ───────────────────────────────────────────────────

    public struct FormRegistered has copy, drop {
        form_id: address,
        creator: address,
        dna: vector<u8>,
        schema_blob_id: String,
        action_type: u8,
        reward_amount: u64,
        eligibility_kind: u8,
        eligibility_amount: u64,
        eligibility_type: String,
        admins: vector<address>,
        viewers: vector<address>,
        created_at_ms: u64,
        expires_at_ms: u64,
        max_per_address: u64,
        max_total_submissions: u64,
        schema_version: u64,
        }

    public struct FormRoleChanged has copy, drop {
        form_id: address,
        wallet: address,
        role: u8,
        enabled: bool,
    }

    public struct ResponseAccepted has copy, drop {
        form_id: address,
        dna: vector<u8>,
        response_blob_id: String,
        submitter: address,
        submission_number: u64,
        global_submission_number: u64,
        schema_version: u64,
        created_at_ms: u64,
    }

    public struct RewardPaid has copy, drop {
        form_id: address,
        submitter: address,
        amount: u64,
        remaining_pool: u64,
    }

    public struct RewardSkipped has copy, drop {
        form_id: address,
        submitter: address,
        reason: u8, // 0 = zero reward, 1 = pool exhausted
    }

    public struct FormActivationChanged has copy, drop {
        form_id: address,
        active: bool,
    }

    public struct FormDrained has copy, drop {
        form_id: address,
        refunded_amount: u64,
    }
    public struct DrainScheduled has copy, drop {
        form_id: address,
        drain_after_ms: u64,
    }

    public struct PoolToppedUp has copy, drop {
        form_id: address,
        amount: u64,
    }

    public struct SchemaUpdated has copy, drop {
        form_id: address,
        new_schema_blob_id: String,
        schema_version: u64,
    }

    public struct RewardAmountUpdated has copy, drop {
        form_id: address,
        new_reward_amount: u64,
    }
    public struct PoolBelowReward has copy, drop {
        form_id: address,
        pool_balance: u64,
        reward_amount: u64,
    }

    public struct MaxSubmissionsChanged has copy, drop {
        form_id: address,
        max_per_address: u64,
        max_total: u64,
    }

    public struct ExpiryExtended has copy, drop {
        form_id: address,
        old_expires_at_ms: u64,
        new_expires_at_ms: u64,
    }
    public struct CreatorTransferProposed has copy, drop {
        form_id: address,
        old_creator: address,
        new_creator: address,
    }
    public struct CreatorTransferred has copy, drop {
        form_id: address,
        old_creator: address,
        new_creator: address,
    }

    // ── Internal helpers ─────────────────────────────────────────

    fun is_admin(form: &Form, who: address): bool {
        form.creator == who || vec_set::contains(&form.admins, &who)
    }

    fun assert_open_eligibility(form: &Form) {
        assert!(form.eligibility_kind == ELIGIBILITY_ANYONE, E_ELIGIBILITY_REQUIRED);
    }

    fun assert_sui_eligible(form: &Form, proof_coin: &Coin<SUI>) {
        assert!(form.eligibility_kind == ELIGIBILITY_MIN_SUI, E_ELIGIBILITY_REQUIRED);
        assert!(coin::value(proof_coin) >= form.eligibility_amount, E_ELIGIBILITY_BALANCE);
    }

    fun assert_coin_eligible<T>(form: &Form, proof_coin: &Coin<T>) {
        assert!(form.eligibility_kind == ELIGIBILITY_COIN, E_ELIGIBILITY_REQUIRED);
        assert!(type_name::with_original_ids<T>().into_string().into_bytes() == *form.eligibility_type.as_bytes(), E_ELIGIBILITY_TYPE);
        assert!(coin::value(proof_coin) >= form.eligibility_amount, E_ELIGIBILITY_BALANCE);
    }

    fun assert_object_eligible<T: key>(form: &Form, _proof_object: &T) {
        assert!(form.eligibility_kind == ELIGIBILITY_OBJECT, E_ELIGIBILITY_REQUIRED);
        assert!(type_name::with_original_ids<T>().into_string().into_bytes() == *form.eligibility_type.as_bytes(), E_ELIGIBILITY_TYPE);
    }

    // ── Module init ──────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        transfer::share_object(Registry {
            id: object::new(ctx),
            forms_created: 0,
            registered_dnas: table::new(ctx),
            dna_to_form_id: table::new(ctx),
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    // ── Public: form lifecycle ───────────────────────────────────

    public fun register_form(
        registry: &mut Registry,
        dna: vector<u8>,
        schema_blob_id: String,
        action_type: u8,
        reward_amount: u64,
        eligibility_kind: u8,
        eligibility_amount: u64,
        eligibility_type: String,
        admins: vector<address>,
        viewers: vector<address>,
        expires_at_ms: u64,
        clock: &Clock,
        initial_pool: Coin<SUI>,
        max_per_address: u64,
        max_total: u64,
        ctx: &mut TxContext,
    ) {
        // Enforce DNA uniqueness across all forms
        assert!(vector::length(&dna) > 0, E_EMPTY_DNA);
        assert!(!table::contains(&registry.registered_dnas, dna), E_DNA_ALREADY_REGISTERED);
        table::add(&mut registry.registered_dnas, dna, true);

        // Validate schema blob ID
        assert!(string::length(&schema_blob_id) > 0, E_EMPTY_SCHEMA);
        assert!(string::length(&schema_blob_id) <= MAX_BLOB_ID_LEN, E_BLOB_ID_TOO_LONG);

        // Validate action type
        assert!(
            action_type == ACTION_NONE || action_type == ACTION_PAY_REWARD,
            E_INVALID_ACTION,
        );

        // Validate eligibility type format
        assert!(
            eligibility_kind == ELIGIBILITY_ANYONE
                || eligibility_kind == ELIGIBILITY_MIN_SUI
                || eligibility_kind == ELIGIBILITY_COIN
                || eligibility_kind == ELIGIBILITY_OBJECT,
            E_INVALID_ELIGIBILITY_KIND
        );
        validate_eligibility_type_from_params(eligibility_kind, &eligibility_type);
        assert!(vector::length(&admins) <= MAX_ROLE_MEMBERS, E_INVALID_LIMITS);
        assert!(vector::length(&viewers) <= MAX_ROLE_MEMBERS, E_INVALID_LIMITS);

        // Validate expiry
        let now_ms = sui::clock::timestamp_ms(clock);
        if (expires_at_ms > 0) {
            assert!(expires_at_ms > now_ms, E_FORM_EXPIRED);
        };

        // Validate pool vs reward
        if (action_type == ACTION_PAY_REWARD) {
            assert!(coin::value(&initial_pool) >= reward_amount, E_INSUFFICIENT_POOL);
        };

        let creator = tx_context::sender(ctx);
        let form_uid = object::new(ctx);
        let form_id = form_uid.to_address();
        table::add(&mut registry.dna_to_form_id, dna, form_id);

        // Convert vectors to VecSet for O(1) lookups
        let admins_set = vec_set::from_keys(admins);
        let viewers_set = vec_set::from_keys(viewers);

        transfer::share_object(Form {
            id: form_uid,
            creator,
            dna,
            schema_blob_id,
            action_type,
            reward_amount,
            eligibility_kind,
            eligibility_amount,
            eligibility_type,
            created_at_ms: now_ms,
            expires_at_ms,
            active: true,
            drained: false,
            fee_pool: coin::into_balance(initial_pool),
            submission_count: 0,
            submitters: table::new(ctx),
            max_submissions_per_address: if (max_per_address > 0) { max_per_address } else { 1 },
            max_total_submissions: max_total,
            reward_locked: false,
            schema_version: 1,
            pending_creator: std::option::none(),
            drain_after_ms: 0,
            admins: admins_set,
            viewers: viewers_set,
        });

        registry.forms_created = registry.forms_created + 1;

        // Emit event after object creation
        event::emit(FormRegistered {
            form_id,
            creator,
            dna,
            schema_blob_id,
            action_type,
            reward_amount,
            eligibility_kind,
            eligibility_amount,
            eligibility_type,
            admins,
            viewers,
            created_at_ms: now_ms,
            expires_at_ms,
            max_per_address: if (max_per_address > 0) { max_per_address } else { 1 },
            max_total_submissions: max_total,
            schema_version: 1,
        });

        // Also emit individual role events for discovery via dashboard
        let mut i = 0;
        let admins_len = vector::length(&admins);
        while (i < admins_len) {
            event::emit(FormRoleChanged {
                form_id,
                wallet: *vector::borrow(&admins, i),
                role: 1, // Admin
                enabled: true,
            });
            i = i + 1;
        };

        let mut j = 0;
        let viewers_len = vector::length(&viewers);
        while (j < viewers_len) {
            event::emit(FormRoleChanged {
                form_id,
                wallet: *vector::borrow(&viewers, j),
                role: 2, // Viewer
                enabled: true,
            });
            j = j + 1;
        };
    }

    fun validate_eligibility_type_from_params(eligibility_kind: u8, eligibility_type: &String) {
        if (eligibility_kind == ELIGIBILITY_COIN || eligibility_kind == ELIGIBILITY_OBJECT) {
            assert!(string::length(eligibility_type) > 0, E_ELIGIBILITY_TYPE);
            assert!(
                string::index_of(eligibility_type, &string::utf8(b"::")) < string::length(eligibility_type),
                E_ELIGIBILITY_TYPE
            );
        };
    }

    // ── Public: submit response (entry for handlers) ─────────────

    /// Core submission logic — validates and records a response.
    /// Handler modules call this, then add their own custom logic.
    /// Returns (form_id, created_at_ms) for handlers to use.
    public(package) fun accept_response(
        form: &mut Form,
        response_blob_id: String,
        clock: &Clock,
        ctx: &TxContext,
    ): (address, u64) {
        assert!(form.active, E_FORM_PAUSED);
        assert!(!form.drained, E_FORM_DRAINED);
        assert!(string::length(&response_blob_id) > 0, E_EMPTY_RESPONSE);
        assert!(string::length(&response_blob_id) <= MAX_BLOB_ID_LEN, E_BLOB_ID_TOO_LONG);

        // Enforce expiry
        if (form.expires_at_ms > 0) {
            assert!(sui::clock::timestamp_ms(clock) <= form.expires_at_ms, E_FORM_EXPIRED);
        };

        let submitter = tx_context::sender(ctx);

        // Check submission limit per address
        let count = if (table::contains(&form.submitters, submitter)) {
            let c = table::remove(&mut form.submitters, submitter);
            c
        } else {
            0
        };
        assert!(count < form.max_submissions_per_address, E_SUBMISSION_LIMIT);
        // Enforce total submission cap (0 = unlimited)
        assert!(form.max_total_submissions == 0 || form.submission_count < form.max_total_submissions, E_SUBMISSION_LIMIT);
        if (form.action_type == ACTION_PAY_REWARD && form.reward_amount > 0) {
            assert!(balance::value(&form.fee_pool) >= form.reward_amount, E_INSUFFICIENT_POOL);
        };
        table::add(&mut form.submitters, submitter, count + 1);
        form.submission_count = form.submission_count + 1;

        let form_id = form.id.to_address();
        let created_at_ms = sui::clock::timestamp_ms(clock);

        // Lock reward after first submission
        if (!form.reward_locked && form.submission_count == 1) {
            form.reward_locked = true;
        };

        event::emit(ResponseAccepted {
            form_id,
            dna: form.dna,
            response_blob_id,
            submitter,
            submission_number: count + 1,
            global_submission_number: form.submission_count,
            schema_version: form.schema_version,
            created_at_ms,
        });

        (form_id, created_at_ms)
    }

    // ── Public: default handlers (built-in) ──────────────────────

    /// Built-in handler: accept response + pay reward.
    /// Use this for standard forms with ACTION_PAY_REWARD or ACTION_NONE.
    public fun submit_and_act(
        form: &mut Form,
        response_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_open_eligibility(form);
        let (form_id, _created_at_ms) = accept_response(form, response_blob_id, clock, ctx);
        execute_reward(form, form_id, ctx);
    }

    public fun submit_and_act_with_sui(
        form: &mut Form,
        proof_coin: &Coin<SUI>,
        response_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_sui_eligible(form, proof_coin);
        let (form_id, _created_at_ms) = accept_response(form, response_blob_id, clock, ctx);
        execute_reward(form, form_id, ctx);
    }

    public fun submit_and_act_with_coin<T>(
        form: &mut Form,
        proof_coin: &Coin<T>,
        response_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_coin_eligible<T>(form, proof_coin);
        let (form_id, _created_at_ms) = accept_response(form, response_blob_id, clock, ctx);
        execute_reward(form, form_id, ctx);
    }

    public fun submit_and_act_with_object<T: key>(
        form: &mut Form,
        proof_object: &T,
        response_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_object_eligible<T>(form, proof_object);
        let (form_id, _created_at_ms) = accept_response(form, response_blob_id, clock, ctx);
        execute_reward(form, form_id, ctx);
    }

    /// Internal: execute reward payout if action_type warrants it.
    /// Under the strict-funded reward policy, submissions abort earlier if the
    /// pool cannot cover the configured reward amount.
    #[allow(lint(self_transfer))]
    fun execute_reward(form: &mut Form, form_id: address, ctx: &mut TxContext) {
        if (form.action_type == ACTION_NONE) {
            return
        };

        if (form.action_type == ACTION_PAY_REWARD) {
            let submitter = tx_context::sender(ctx);
            // Skip payout if reward is zero — response already recorded
            if (form.reward_amount == 0) {
                event::emit(RewardSkipped {
                    form_id,
                    submitter,
                    reason: 0,
                });
                return
            };
            let reward = coin::take(&mut form.fee_pool, form.reward_amount, ctx);
            let remaining = balance::value(&form.fee_pool);
            transfer::public_transfer(reward, submitter);
            event::emit(RewardPaid {
                form_id,
                submitter,
                amount: form.reward_amount,
                remaining_pool: remaining,
            });
            if (remaining < form.reward_amount && form.reward_amount > 0) {
                event::emit(PoolBelowReward {
                    form_id,
                    pool_balance: remaining,
                    reward_amount: form.reward_amount,
                });
            };
            return
        };
    }

    // ── Public: admin management ─────────────────────────────────

    public fun set_admin(form: &mut Form, wallet: address, enabled: bool, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        let changed = if (enabled) {
            if (!vec_set::contains(&form.admins, &wallet)) {
                assert!(vec_set::length(&form.admins) < MAX_ROLE_MEMBERS, E_INVALID_LIMITS);
                vec_set::insert(&mut form.admins, wallet);
                true
            } else { false }
        } else {
            if (vec_set::contains(&form.admins, &wallet)) {
                vec_set::remove(&mut form.admins, &wallet);
                true
            } else { false }
        };
        if (changed) {
            event::emit(FormRoleChanged {
                form_id: form.id.to_address(),
                wallet,
                role: 1,
                enabled,
            });
        };
    }

    public fun set_viewer(form: &mut Form, wallet: address, enabled: bool, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        let changed = if (enabled) {
            if (!vec_set::contains(&form.viewers, &wallet)) {
                assert!(vec_set::length(&form.viewers) < MAX_ROLE_MEMBERS, E_INVALID_LIMITS);
                vec_set::insert(&mut form.viewers, wallet);
                true
            } else { false }
        } else {
            if (vec_set::contains(&form.viewers, &wallet)) {
                vec_set::remove(&mut form.viewers, &wallet);
                true
            } else { false }
        };
        if (changed) {
            event::emit(FormRoleChanged {
                form_id: form.id.to_address(),
                wallet,
                role: 2,
                enabled,
            });
        };
    }

    // ── Public: pool management ──────────────────────────────────

    /// Add SUI to the reward pool. Only the creator can call this at any time,
    /// including after reward_locked is set. This is intentional: the lock
    /// prevents changing the per-submitter reward_amount, but topping up
    /// extends how many submitters can be paid at that fixed rate.
    public fun top_up_pool(form: &mut Form, coins: Coin<SUI>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        assert!(!form.drained, E_FORM_DRAINED);
        let amount = coin::value(&coins);
        balance::join(&mut form.fee_pool, coin::into_balance(coins));
        event::emit(PoolToppedUp {
            form_id: form.id.to_address(),
            amount,
        });
    }

    // ── Public: form controls ────────────────────────────────────

    public fun set_form_active(form: &mut Form, active: bool, ctx: &mut TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        // Prevent reactivation of drained forms
        assert!(!form.drained || !active, E_FORM_DRAINED);
        form.active = active;
        event::emit(FormActivationChanged {
            form_id: form.id.to_address(),
            active,
        });
    }

    /// Update the schema blob ID for a form.
    /// TRUST ASSUMPTION: This can be called after submissions exist. Already-
    /// submitted responses reference the old schema. Callers (indexers, UI)
    /// should track schema version per submission timestamp. Intentional for
    /// minor edits; destructive changes should create a new form instead.
    public fun update_schema_blob_id(form: &mut Form, new_schema_blob_id: String, ctx: &mut TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        assert!(string::length(&new_schema_blob_id) > 0, E_EMPTY_SCHEMA);
        assert!(string::length(&new_schema_blob_id) <= MAX_BLOB_ID_LEN, E_BLOB_ID_TOO_LONG);
        form.schema_blob_id = new_schema_blob_id;
        form.schema_version = form.schema_version + 1;
        event::emit(SchemaUpdated {
            form_id: form.id.to_address(),
            new_schema_blob_id,
            schema_version: form.schema_version,
        });
    }

    public fun update_reward_amount(form: &mut Form, new_reward_amount: u64, ctx: &mut TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        assert!(!form.reward_locked, E_REWARD_LOCKED);
        form.reward_amount = new_reward_amount;
        event::emit(RewardAmountUpdated {
            form_id: form.id.to_address(),
            new_reward_amount,
        });
        if (new_reward_amount > 0 && balance::value(&form.fee_pool) < new_reward_amount) {
            event::emit(PoolBelowReward {
                form_id: form.id.to_address(),
                pool_balance: balance::value(&form.fee_pool),
                reward_amount: new_reward_amount,
            });
        };
    }

    public fun set_max_submissions(form: &mut Form, max_per_address: u64, max_total: u64, ctx: &mut TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        assert!(max_per_address > 0, E_INVALID_LIMITS);
        assert!(max_total == 0 || max_total >= form.submission_count, E_INVALID_LIMITS);
        form.max_submissions_per_address = max_per_address;
        form.max_total_submissions = max_total;
        event::emit(MaxSubmissionsChanged {
            form_id: form.id.to_address(),
            max_per_address,
            max_total,
        });
    }

    /// Drain remaining pool and permanently deactivate a form.
    /// Only the creator can call this.
    ///
    /// SAFETY: This can be called even when submissions exist. The pool is
    /// drained to the creator and the form is permanently disabled. Any
    /// submissions recorded via accept_response (without execute_reward)
    /// remain on-chain. Built-in handlers (submit_and_act) pay rewards
    /// atomically with submission, so draining mid-flight only affects
    /// future submissions. Custom handlers that call accept_response
    /// without execute_reward should be aware the pool may be drained
    /// before they attempt payout.
    public fun drain_and_deactivate(form: &mut Form, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        assert!(!form.drained, E_FORM_DRAINED);

        form.active = false;
        form.drained = true;

        // Return entire pool to creator
        let remaining_mist = balance::value(&form.fee_pool);
        if (remaining_mist > 0) {
            let refund = coin::take(&mut form.fee_pool, remaining_mist, ctx);
            transfer::public_transfer(refund, form.creator);
        };

        event::emit(FormDrained {
            form_id: form.id.to_address(),
            refunded_amount: remaining_mist,
        });
        event::emit(FormActivationChanged {
            form_id: form.id.to_address(),
            active: false,
        });
    }

    public fun pause_and_schedule_drain(form: &mut Form, clock: &Clock, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        assert!(!form.drained, E_FORM_DRAINED);
        form.active = false;
        let at = sui::clock::timestamp_ms(clock) + DRAIN_DELAY_MS;
        form.drain_after_ms = at;
        event::emit(FormActivationChanged { form_id: form.id.to_address(), active: false });
        event::emit(DrainScheduled { form_id: form.id.to_address(), drain_after_ms: at });
    }

    public fun execute_scheduled_drain(form: &mut Form, clock: &Clock, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        assert!(!form.drained, E_FORM_DRAINED);
        assert!(form.drain_after_ms > 0 && sui::clock::timestamp_ms(clock) >= form.drain_after_ms, E_DRAIN_NOT_READY);
        form.drain_after_ms = 0;
        drain_and_deactivate(form, ctx);
    }

    public fun cancel_scheduled_drain(form: &mut Form, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        assert!(!form.drained, E_FORM_DRAINED);
        assert!(form.drain_after_ms > 0, E_DRAIN_NOT_READY);
        form.drain_after_ms = 0;
        form.active = true;
        event::emit(FormActivationChanged { form_id: form.id.to_address(), active: true });
    }

    public fun extend_expiry(form: &mut Form, new_expires_at_ms: u64, clock: &Clock, ctx: &mut TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        let now_ms = sui::clock::timestamp_ms(clock);
        assert!(form.expires_at_ms == 0 || now_ms <= form.expires_at_ms, E_FORM_EXPIRED);
        assert!(new_expires_at_ms > now_ms, E_FORM_EXPIRED);
        assert!(new_expires_at_ms > form.expires_at_ms, E_FORM_EXPIRED);
        let old_expires_at_ms = form.expires_at_ms;
        form.expires_at_ms = new_expires_at_ms;
        event::emit(ExpiryExtended {
            form_id: form.id.to_address(),
            old_expires_at_ms,
            new_expires_at_ms,
        });
    }

    public fun propose_creator_transfer(form: &mut Form, new_creator: address, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == form.creator, E_NOT_CREATOR);
        form.pending_creator = std::option::some(new_creator);
        event::emit(CreatorTransferProposed {
            form_id: form.id.to_address(),
            old_creator: form.creator,
            new_creator,
        });
    }

    public fun accept_creator_transfer(form: &mut Form, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(std::option::is_some(&form.pending_creator), E_NO_PENDING_CREATOR);
        assert!(sender == *std::option::borrow(&form.pending_creator), E_NOT_PENDING_CREATOR);
        let old = form.creator;
        form.creator = sender;
        let _old_pending = std::option::extract(&mut form.pending_creator);
        event::emit(CreatorTransferred {
            form_id: form.id.to_address(),
            old_creator: old,
            new_creator: sender,
        });
    }

    public fun set_admins_batch(form: &mut Form, wallets: vector<address>, enabled: bool, ctx: &TxContext) {
        assert!(vector::length(&wallets) <= MAX_ROLE_MEMBERS, E_INVALID_LIMITS);
        let mut i = 0;
        let n = vector::length(&wallets);
        while (i < n) {
            let wallet = *vector::borrow(&wallets, i);
            set_admin(form, wallet, enabled, ctx);
            i = i + 1;
        };
    }

    public fun set_viewers_batch(form: &mut Form, wallets: vector<address>, enabled: bool, ctx: &TxContext) {
        assert!(vector::length(&wallets) <= MAX_ROLE_MEMBERS, E_INVALID_LIMITS);
        let mut i = 0;
        let n = vector::length(&wallets);
        while (i < n) {
            let wallet = *vector::borrow(&wallets, i);
            set_viewer(form, wallet, enabled, ctx);
            i = i + 1;
        };
    }

    // ── Public: Seal integration ─────────────────────────────────

    /// Authorization guard: verify caller is an admin and the id matches form DNA.
    /// The function name `seal_approve` is required by the Seal SDK — it parses
    /// transaction bytes looking for this exact function name to extract the
    /// identity ID for key derivation. Renaming will break decryption.
    ///
    /// NOTE: This is NOT a cryptographic Seal operation by itself — it is an
    /// on-chain authorization check that the Seal SDK uses as a gate before
    /// releasing decryption shares. The actual crypto happens on the key servers.
    public fun seal_approve(id: vector<u8>, form: &Form, ctx: &TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)), E_NOT_AUTHORIZED);
        assert!(form.dna == id, E_NOT_AUTHORIZED);
    }

    /// On-chain guard for dashboard access. Checks if caller is admin or viewer.
    public(package) fun assert_dashboard_access(form: &Form, ctx: &TxContext) {
        assert!(is_admin(form, tx_context::sender(ctx)) || vec_set::contains(&form.viewers, &tx_context::sender(ctx)), E_NOT_AUTHORIZED);
    }

    public fun has_dashboard_access(form: &Form, addr: address): bool {
        is_admin(form, addr) || vec_set::contains(&form.viewers, &addr)
    }

    // ── Public: read helpers ─────────────────────────────────────

    public fun is_active(form: &Form): bool {
        form.active && !form.drained
    }

    public fun submission_count(form: &Form): u64 {
        form.submission_count
    }

    public fun pool_balance(form: &Form): u64 {
        balance::value(&form.fee_pool)
    }

    public fun is_submitter(form: &Form, addr: address): bool {
        table::contains(&form.submitters, addr)
    }

    public fun submission_count_of(form: &Form, addr: address): u64 {
        if (table::contains(&form.submitters, addr)) {
            *table::borrow(&form.submitters, addr)
        } else {
            0
        }
    }

    public fun registry_count(registry: &Registry): u64 {
        registry.forms_created
    }

    public fun has_form_for_dna(registry: &Registry, dna: vector<u8>): bool {
        table::contains(&registry.dna_to_form_id, dna)
    }

    public fun form_id_for_dna(registry: &Registry, dna: vector<u8>): address {
        *table::borrow(&registry.dna_to_form_id, dna)
    }

    public fun is_drained(form: &Form): bool {
        form.drained
    }

    public fun expires_at_ms(form: &Form): u64 {
        form.expires_at_ms
    }

    public fun reward_amount(form: &Form): u64 {
        form.reward_amount
    }

    public fun creator(form: &Form): address {
        form.creator
    }

    public fun dna(form: &Form): vector<u8> {
        form.dna
    }

    public fun schema_blob_id(form: &Form): String {
        form.schema_blob_id
    }

    public fun action_type(form: &Form): u8 {
        form.action_type
    }

    public fun eligibility_kind(form: &Form): u8 {
        form.eligibility_kind
    }

    public fun max_submissions_per_address(form: &Form): u64 {
        form.max_submissions_per_address
    }

    public fun is_reward_locked(form: &Form): bool {
        form.reward_locked
    }

    public fun max_total_submissions(form: &Form): u64 {
        form.max_total_submissions
    }

    // ── Test helpers ────────────────────────────────────────────

    #[test_only]
    public fun new_registry_for_testing(ctx: &mut TxContext): Registry {
        Registry {
            id: object::new(ctx),
            forms_created: 0,
            registered_dnas: table::new(ctx),
            dna_to_form_id: table::new(ctx),
        }
    }

    #[test_only]
    public fun new_form_for_testing(
        creator: address,
        action_type: u8,
        reward_amount: u64,
        expires_at_ms: u64,
        ctx: &mut TxContext,
    ): Form {
        Form {
            id: object::new(ctx),
            creator,
            dna: x"01",
            schema_blob_id: string::utf8(b"blob"),
            action_type,
            reward_amount,
            eligibility_kind: ELIGIBILITY_ANYONE,
            eligibility_amount: 0,
            eligibility_type: string::utf8(b""),
            created_at_ms: 0,
            expires_at_ms,
            active: true,
            drained: false,
            fee_pool: coin::into_balance(coin::zero<SUI>(ctx)),
            submission_count: 0,
            submitters: table::new(ctx),
            max_submissions_per_address: 1,
            max_total_submissions: 0,
            reward_locked: false,
            schema_version: 1,
            pending_creator: std::option::none(),
            drain_after_ms: 0,
            admins: vec_set::empty(),
            viewers: vec_set::empty(),
        }
    }

    #[test_only]
    public fun set_submission_count_for_testing(form: &mut Form, count: u64) {
        form.submission_count = count;
    }

    #[test_only]
    public fun destroy_registry_for_testing(registry: Registry) {
        let Registry { id, forms_created: _, registered_dnas, dna_to_form_id } = registry;
        table::drop(registered_dnas);
        table::drop(dna_to_form_id);
        id.delete();
    }

    #[test_only]
    public fun destroy_form_for_testing(form: Form, ctx: &mut TxContext) {
        let Form {
            id,
            creator: _,
            dna: _,
            schema_blob_id: _,
            action_type: _,
            reward_amount: _,
            eligibility_kind: _,
            eligibility_amount: _,
            eligibility_type: _,
            created_at_ms: _,
            expires_at_ms: _,
            active: _,
            drained: _,
            mut fee_pool,
            submission_count: _,
            submitters,
            max_submissions_per_address: _,
            max_total_submissions: _,
            reward_locked: _,
            schema_version: _,
            pending_creator: _,
            drain_after_ms: _,
            admins: _,
            viewers: _,
        } = form;

        let pool_value = balance::value(&fee_pool);
        if (pool_value > 0) {
            let refund = coin::from_balance(balance::withdraw_all(&mut fee_pool), ctx);
            transfer::public_transfer(refund, tx_context::sender(ctx));
        };
        balance::destroy_zero(fee_pool);
        table::drop(submitters);
        id.delete();
    }

}
