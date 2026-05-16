#[test_only]
module formrus::tests {
    use std::string;
    use formrus::registry;
    use sui::clock;
    use sui::coin;
    use sui::sui::SUI;

    #[test]
    fun test_registry_dna_lookup_added_on_register() {
        let mut ctx = tx_context::new_from_hint(@0xA, 1, 0, 0, 0);
        let clock_obj = clock::create_for_testing(&mut ctx);
        let mut registry_obj = registry::new_registry_for_testing(&mut ctx);

        registry::register_form(
            &mut registry_obj,
            x"aa",
            string::utf8(b"schema_blob_1"),
            0,
            0,
            0,
            0,
            string::utf8(b""),
            vector[],
            vector[],
            0,
            &clock_obj,
            coin::zero<SUI>(&mut ctx),
            1,
            0,
            &mut ctx,
        );

        assert!(registry::registry_count(&registry_obj) == 1, 0);
        assert!(registry::has_form_for_dna(&registry_obj, x"aa"), 1);
        assert!(registry::form_id_for_dna(&registry_obj, x"aa") != @0x0, 2);
        registry::destroy_registry_for_testing(registry_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test, expected_failure(abort_code = 26, location = formrus::registry)]
    fun test_register_rejects_invalid_eligibility_kind() {
        let mut ctx = tx_context::new_from_hint(@0xA, 11, 0, 0, 0);
        let clock_obj = clock::create_for_testing(&mut ctx);
        let mut registry_obj = registry::new_registry_for_testing(&mut ctx);
        registry::register_form(
            &mut registry_obj,
            x"bb",
            string::utf8(b"schema_blob_invalid_kind"),
            0,
            0,
            99,
            0,
            string::utf8(b""),
            vector[],
            vector[],
            0,
            &clock_obj,
            coin::zero<SUI>(&mut ctx),
            1,
            0,
            &mut ctx,
        );
        registry::destroy_registry_for_testing(registry_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test, expected_failure(abort_code = 22, location = formrus::registry)]
    fun test_register_rejects_initial_role_list_over_cap() {
        let mut ctx = tx_context::new_from_hint(@0xA, 13, 0, 0, 0);
        let clock_obj = clock::create_for_testing(&mut ctx);
        let mut registry_obj = registry::new_registry_for_testing(&mut ctx);
        let admins = vector[
            @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1,
            @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1,
            @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1,
            @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1,
            @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1, @0x1,
            @0x1
        ];
        registry::register_form(
            &mut registry_obj,
            x"bc",
            string::utf8(b"schema_blob_role_cap"),
            0,
            0,
            0,
            0,
            string::utf8(b""),
            admins,
            vector[],
            0,
            &clock_obj,
            coin::zero<SUI>(&mut ctx),
            1,
            0,
            &mut ctx,
        );
        registry::destroy_registry_for_testing(registry_obj);
        clock::destroy_for_testing(clock_obj);
    }

    #[test]
    fun test_creator_can_manage_roles() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 2, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        registry::set_admin(&mut form, @0xB, true, &creator_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
    }

    #[test, expected_failure(abort_code = 1, location = formrus::registry)]
    fun test_non_creator_cannot_manage_roles() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 3, 0, 0, 0);
        let attacker_ctx = tx_context::new_from_hint(@0xC, 4, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        registry::set_admin(&mut form, @0xD, true, &attacker_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
    }

    #[test, expected_failure(abort_code = 22, location = formrus::registry)]
    fun test_limits_reject_max_total_below_existing_submissions() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 5, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        registry::set_submission_count_for_testing(&mut form, 3);
        registry::set_max_submissions(&mut form, 1, 2, &mut creator_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
    }

    #[test, expected_failure(abort_code = 16, location = formrus::registry)]
    fun test_extend_expiry_rejects_already_expired_form() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 6, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 100, &mut creator_ctx);
        let mut clock_obj = clock::create_for_testing(&mut creator_ctx);
        clock::set_for_testing(&mut clock_obj, 200);
        registry::extend_expiry(&mut form, 400, &clock_obj, &mut creator_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
        clock::destroy_for_testing(clock_obj);
    }

    #[test, expected_failure(abort_code = 25, location = formrus::registry)]
    fun test_scheduled_drain_cannot_execute_early() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 7, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        let clock_obj = clock::create_for_testing(&mut creator_ctx);
        registry::pause_and_schedule_drain(&mut form, &clock_obj, &mut creator_ctx);
        registry::execute_scheduled_drain(&mut form, &clock_obj, &mut creator_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
        clock::destroy_for_testing(clock_obj);
    }

    #[test]
    fun test_scheduled_drain_executes_after_delay() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 8, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        let mut clock_obj = clock::create_for_testing(&mut creator_ctx);
        registry::pause_and_schedule_drain(&mut form, &clock_obj, &mut creator_ctx);
        clock::increment_for_testing(&mut clock_obj, 3_600_000);
        registry::execute_scheduled_drain(&mut form, &clock_obj, &mut creator_ctx);
        assert!(registry::is_drained(&form), 3);
        assert!(!registry::is_active(&form), 4);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
        clock::destroy_for_testing(clock_obj);
    }

    #[test, expected_failure(abort_code = 19, location = formrus::registry)]
    fun test_top_up_rejects_drained_form() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 12, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 0, 0, 0, &mut creator_ctx);
        registry::drain_and_deactivate(&mut form, &mut creator_ctx);
        registry::top_up_pool(&mut form, coin::mint_for_testing<SUI>(10, &mut creator_ctx), &mut creator_ctx);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
    }

    #[test]
    fun test_reward_flow_locks_after_first_submission_and_pays() {
        let mut creator_ctx = tx_context::new_from_hint(@0xA, 9, 0, 0, 0);
        let mut form = registry::new_form_for_testing(@0xA, 1, 10, 0, &mut creator_ctx);
        registry::top_up_pool(&mut form, coin::mint_for_testing<SUI>(30, &mut creator_ctx), &mut creator_ctx);
        let clock_obj = clock::create_for_testing(&mut creator_ctx);
        let mut submitter_ctx = tx_context::new_from_hint(@0xB, 10, 0, 0, 0);

        registry::submit_and_act(
            &mut form,
            string::utf8(b"response_blob_1"),
            &clock_obj,
            &mut submitter_ctx,
        );

        assert!(registry::is_reward_locked(&form), 5);
        assert!(registry::submission_count(&form) == 1, 6);
        assert!(registry::pool_balance(&form) == 20, 7);
        registry::destroy_form_for_testing(form, &mut creator_ctx);
        clock::destroy_for_testing(clock_obj);
    }
}
