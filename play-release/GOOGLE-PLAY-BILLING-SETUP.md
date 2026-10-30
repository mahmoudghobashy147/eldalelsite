# Google Play Billing candidate — not deployed

This candidate separates native Android checkout from web checkout. The website keeps its existing manual Vodafone Cash / InstaPay flow. Android registration and payment overlays use Play Billing, including localized Play prices. Purchases are verified against the Android Publisher API and bound to the Firebase uid through a SHA-256 obfuscated account identifier. The native client cannot grant itself entitlement.

## Console setup required before enabling purchases

Create six separate subscription products (different benefits), each with a prepaid base plan `annual-prepaid`, duration **1 year**, no automatic renewal. Configure Egypt availability and confirm the displayed EGP price before activation. Do not configure trials or introductory offers in this candidate. Disable Play Store extension for now: in-app purchase changes/top-ups during an active subscription are intentionally blocked to prevent double charging.

| Product ID | Existing plan key | Annual EGP target |
|---|---|---:|
| eldalel_starter_annual | starter | 100 |
| eldalel_basic_annual | basic | 200 |
| eldalel_premium_annual | premium | 300 |
| eldalel_vip_annual | vip | 600 |
| eldalel_company_annual | company | 1000 |
| eldalel_elite_annual | elite | 2000 |

The checkout shows Google's localized price, not the website's admin price. Changing website pricing does not change Play pricing. Plan post/video benefits remain the existing admin configuration; all plans retain five portfolio images.

Complete a payments profile and merchant payout details in Play Console. Enable Android Publisher API in the backend project. Grant the Firebase Functions runtime service account the minimum Play Console app access to view purchases and manage/acknowledge subscriptions for this application. Use Application Default Credentials, not downloadable keys in the app or repository.

Configure RTDN for topic `projects/eldalel-elshamel/topics/play-billing-notifications`, granting Google Play's documented publisher identity publish access. Test notification delivery. Backend exports verification, preparation, RTDN handling and hourly reconciliation. No purchase is granted while pending. Cancellation retains entitlement until Google's expiry; hold, pause, expiry and revocation remove Play-backed activation on reconciliation. Existing unrelated manual entitlements are never overwritten by stale Play notifications.

After deploying and testing the backend and reviewed rules, set server-controlled `config/playBilling.enabled` to true. Until then preparePlayPurchase rejects checkout. This is a rollout safety gate, not a way to show reviewers a different payment flow.

## Build

Web prebuild runs `scripts/apply-play-billing.cjs` after existing patches. Native builds must run `node scripts/install-play-billing-native.cjs` **after** `npx cap sync android`. The candidate workflow installs the bridge and builds an unsigned AAB/debug APK without deploying hosting or backend. Signing must use the established upload key; do not upload an unsigned candidate.

## Required validation before public rollout

- Genuine Play license tester: all six products, localized price, annual duration, pending payment, cancellation, successful verification, restored purchase and interrupted checkout.
- Wrong Firebase account cannot claim a token. Concurrent calls remain idempotent; no repeated payments or subscription extension.
- RTDN and schedule: refund/revocation, expiration, hold, canceled-but-not-expired and recovery.
- Existing manual subscribers keep access; web manual receipt flow still works.
- Android profile editor, registration, upgrade screens and legal/help content must have no external digital payment directions. Complete the audit of funded advertising purchase links and shared help/support content before release.
- Account deletion fulfillment and accurate Data safety declarations remain separate release blockers; this PR does not implement them.

No live account deleted, no production entitlement changed, no Firebase Rules deployed, no real payment made. Unit tests are not proof of real Play integration. New subscription purchases are blocked while a current paid term is active; plan replacement/proration is deliberately not implemented in this first candidate.
