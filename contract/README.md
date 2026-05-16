# Formrus Move Contract

Module: `formrus::registry`  
Source: `contract/sources/formrus.move`

This module implements shared on-chain forms with:
- eligibility-gated submissions
- optional reward payouts from pool
- role-based administration
- schema versioning and expiry controls
- immediate/scheduled drain operations

## What Makes Formrus Unique

1. **DNA Uniqueness Enforcement**
- DNA is registered in `Registry.registered_dnas` and rejected on collision (`E_DNA_ALREADY_REGISTERED`).
- Registry also keeps `dna_to_form_id` for deterministic lookup.

2. **Handler Model**
- Public built-ins (`submit_and_act*`) are the default safe path.
- All built-ins converge on package-internal `accept_response(...)` so validation is centralized.
- This separates core acceptance guarantees from post-accept action logic.

3. **Schema Evolution Tracking**
- `update_schema_blob_id` increments `schema_version`.
- `ResponseAccepted` emits `schema_version`, enabling historical response decoding against the right schema revision.

4. **Seal Gate Integration**
- `seal_approve` intentionally uses exact function naming expected by client Seal flow.
- Enforces creator/admin role and DNA match before decryption authorization.

5. **Live-Form Safety Controls**
- reward lock after first submission (`E_REWARD_LOCKED`)
- strict-funded reward checks (`E_INSUFFICIENT_POOL`)
- form drain irreversibility (`E_FORM_DRAINED`)
- delayed drain path (`pause_and_schedule_drain` / `execute_scheduled_drain`)

## Object Model

## `Registry` (shared)
- tracks total forms created
- enforces DNA uniqueness
- maps DNA -> form object address

## `Form` (shared)
- creator/admin/viewer access model
- schema blob pointer + `schema_version`
- eligibility/rules config
- reward pool (`Balance<SUI>`)
- submission counters (global + per wallet)
- expiry and drain scheduling flags

## Constants

### Action Types
- `ACTION_NONE = 0`
- `ACTION_PAY_REWARD = 1`

### Eligibility Kinds
- `ELIGIBILITY_ANYONE = 0`
- `ELIGIBILITY_MIN_SUI = 1`
- `ELIGIBILITY_COIN = 2`
- `ELIGIBILITY_OBJECT = 3`

### Limits
- `MAX_BLOB_ID_LEN = 256`
- `MAX_ROLE_MEMBERS = 50`
- `DRAIN_DELAY_MS = 3_600_000` (1 hour)

## Public API (Current)

## Form Lifecycle
- `register_form(...)`
- `extend_expiry(...)`
- `drain_and_deactivate(...)`
- `pause_and_schedule_drain(...)`
- `execute_scheduled_drain(...)`
- `cancel_scheduled_drain(...)`
- `propose_creator_transfer(...)`
- `accept_creator_transfer(...)`

## Submission Handlers (built-in)
- `submit_and_act(...)`
- `submit_and_act_with_sui(...)`
- `submit_and_act_with_coin<T>(...)`
- `submit_and_act_with_object<T: key>(...)`

All built-ins route through package-internal `accept_response(...)`, which enforces:
- active + not drained
- blob ID validity
- expiry window
- per-wallet + total submission caps
- reward pool sufficiency (for reward mode)

## Admin and Controls
- `set_admin(...)`
- `set_viewer(...)`
- `set_admins_batch(...)`
- `set_viewers_batch(...)`
- `set_form_active(...)`
- `top_up_pool(...)`
- `update_schema_blob_id(...)`
- `update_reward_amount(...)`
- `set_max_submissions(...)`

## Seal Integration
- `seal_approve(id, form, ctx)`
  - verifies caller is creator/admin and DNA matches
  - used as authorization gate for Seal decryption flow

## Read Helpers
- `has_dashboard_access(...)`
- `is_active(...)`
- `submission_count(...)`
- `pool_balance(...)`
- `is_submitter(...)`
- `submission_count_of(...)`
- `registry_count(...)`
- `has_form_for_dna(...)`
- `form_id_for_dna(...)`
- `is_drained(...)`
- `expires_at_ms(...)`
- `reward_amount(...)`
- `creator(...)`
- `dna(...)`
- `schema_blob_id(...)`
- `action_type(...)`
- `eligibility_kind(...)`
- `max_submissions_per_address(...)`
- `is_reward_locked(...)`
- `max_total_submissions(...)`

## Events Emitted

- `FormRegistered`
- `FormRoleChanged`
- `ResponseAccepted`
- `RewardPaid`
- `RewardSkipped`
- `FormActivationChanged`
- `FormDrained`
- `DrainScheduled`
- `PoolToppedUp`
- `SchemaUpdated`
- `RewardAmountUpdated`
- `PoolBelowReward`
- `MaxSubmissionsChanged`
- `ExpiryExtended`
- `CreatorTransferProposed`
- `CreatorTransferred`

## Error Codes

- `1` `E_NOT_CREATOR`
- `2` `E_FORM_PAUSED`
- `5` `E_INSUFFICIENT_POOL`
- `6` `E_ELIGIBILITY_REQUIRED`
- `7` `E_ELIGIBILITY_TYPE`
- `8` `E_ELIGIBILITY_BALANCE`
- `9` `E_NOT_AUTHORIZED`
- `10` `E_DNA_ALREADY_REGISTERED`
- `12` `E_INVALID_ACTION`
- `13` `E_EMPTY_DNA`
- `14` `E_EMPTY_SCHEMA`
- `15` `E_EMPTY_RESPONSE`
- `16` `E_FORM_EXPIRED`
- `17` `E_SUBMISSION_LIMIT`
- `18` `E_REWARD_LOCKED`
- `19` `E_FORM_DRAINED`
- `21` `E_BLOB_ID_TOO_LONG`
- `22` `E_INVALID_LIMITS`
- `23` `E_NO_PENDING_CREATOR`
- `24` `E_NOT_PENDING_CREATOR`
- `25` `E_DRAIN_NOT_READY`
- `26` `E_INVALID_ELIGIBILITY_KIND`

## Behavioral Notes

- Reward amount becomes locked after first accepted response (`reward_locked`).
- Drained forms cannot be reactivated.
- `update_schema_blob_id` increments `schema_version`; submissions emit the schema version used at acceptance.
- `expires_at_ms == 0` means no expiry.

## Testing

Move tests live in `contract/sources/tests.move`.

Run (with Sui CLI installed and writable Move cache):

```bash
cd contract
sui move test
```
