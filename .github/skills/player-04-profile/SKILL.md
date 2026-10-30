---
name: player-04-profile
description: "Implement the self-owned player profile and onboarding inputs used before the verified video baseline and personal roadmap."
disable-model-invocation: true
---
Implement individual player profile onboarding and editing.

Read [player instructions](../../instructions/player-mobile.instructions.md), [API instructions](../../instructions/player-api.instructions.md), and [delivery guide](../../../docs/features/individual-player/README.md). Prerequisites: 01-02 and the agreed self-profile contract.

Use the [approved player journey](../../../docs/features/individual-player/README.md#approved-player-journey) and [roadmap contract](../../../docs/features/individual-player/roadmap.md): profile disciplines, experience, preferences, and goals are completed after login/dashboard and before the verified video baseline. Revisit this ordering and the baseline gate when profile fields or onboarding completion change.

- Reuse existing identity/tenant models where appropriate. Individual approval currently creates a tenant but no member row: add a durable, idempotent self-profile mapping without granting club-management permissions or cloning the account.
- Implement view/edit for supported name, avatar, age band/required consent, batting handedness, bowling style, primary disciplines, experience, goals and relevant preferences. Agree fields and validation; do not collect unnecessary sensitive data.
- Distinguish verified identity fields from editable cricket profile fields. Do not allow arbitrary email/role/tenant edits.
- Enforce exactly one active self player per individual entitlement on the backend. No roster, squad, coach assignment, invite-member or add-second-player action.
- Add owner-scoped profile read/update/avatar contracts in the existing platform API if missing, with content validation and private media handling. Use concurrent-update protection consistent with existing patterns.
- Support onboarding completion/resume, validation, unsaved edits, save failure/retry, accessible image selection and permission denial. Scope profile cache to the authenticated account.

Acceptance: create/read/update works for a real approved player, repeated initialization is idempotent, a second profile is rejected server-side, another user's IDs cannot be accessed, and age/guardian decisions gate release where unresolved. Profile screens and API ownership/validation have focused tests.
