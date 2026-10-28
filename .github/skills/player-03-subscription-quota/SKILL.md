---
name: player-03-subscription-quota
description: "Implement the individual plan, secure checkout, subscription lifecycle and server-enforced five-analysis allowance."
disable-model-invocation: true
---
Implement player subscription and quota management.

Read [player instructions](../instructions/player-mobile.instructions.md), [API instructions](../instructions/player-api.instructions.md), and [delivery guide](../../docs/features/individual-player/README.md). Prerequisites: 00-02 and approved payment/product decisions.

- Show the target individual offer: GBP 14.99 monthly, one player, five AI action uploads per month, four-discipline roadmap, Drive, solo drills, biomechanics scorecard and milestone certificates. Fetch authoritative price/currency/terms and entitlements; reconcile the backend currency inconsistency before enabling purchase.
- Preserve checkout -> system-admin approval. Agree when payment/billing begins, rejection refunds/voids, pending cancellation, recurring renewal, payment failure/grace, expiration and reactivation.
- Inspect current Apple/Google policies and agree the permitted purchase mechanism for this digital subscription. Implement real sandbox-tested store/provider purchase verification, idempotent signed webhook processing and restoration where applicable. Do not collect raw card data or use the legacy simulated paid invoice as proof.
- Add owner-safe subscription/usage/status APIs in existing services where absent. Represent active, pending, expired, cancelled-at-period-end and payment-error states without conflating them with login.
- Enforce one active self player and five monthly AI submissions on the backend across device/Drive and supported analysis entry points. Define period/reset timezone, atomic reservation, concurrent requests, idempotent retries, failures/cancellation/refunds, and whether reanalysis consumes another unit before implementation.
- Display used/remaining allowance and reset date, handle server 429 with an actionable message, and refresh after submission/renewal. Never decrement solely on the client or charge twice on retry.
- Provide compliant manage/cancel subscription and restore purchases actions. Clarify access until paid-period end; do not promise unimplemented annual plans.

Acceptance: sandbox purchase/renewal/cancellation/restoration and approval lifecycle work. Test the exact five-successful-reservation boundary, sixth rejection, simultaneous submissions, retries, failed-job policy, reset boundary, cross-user access and club subscription regression. Block production checkout explicitly if real payment integration is not configured.
