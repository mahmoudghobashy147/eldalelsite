# Account deletion operations

The app and `/?delete-account=1` accept a password-reauthenticated request. This
release adds an **operator-run** fulfillment tool, not an automatic deletion
trigger. Assign a trusted operator to review the private pending/processing
queue regularly and respond to requests. Do not call a request completed until
the tool confirms that content and Auth deletion finished.

No production account has been deleted while developing this feature.

## Before handling a real request

- Use a private trusted machine with authorized Application Default Credentials
  for `eldalel-elshamel`. Never put credentials or personal plans in GitHub,
  public workflow artifacts, screenshots, support messages or the app bundle.
- Confirm the request belongs to the target account and review any active
  subscription/refund/support issue. Prepaid Play terms do not auto-renew.
  Do not require a payment or design delivery to accept a deletion request.
- Transfer administrator ownership separately. The tool refuses admin accounts.
- Review unresolved ownership of legacy ads/media or data with no reliable UID.
  The tool blocks completion on unmapped UID/phone/email references. It does
  not guess that another member's records belong to the requesting account.

## Procedure (one account only)

Replace TARGET_UID with the verified requester UID; these examples never
contain real customer data. Install Functions dependencies first.

1. Read-only inventory; choose a new private path **outside the checkout**:

   `node scripts/fulfill-account-deletion.cjs --uid TARGET_UID --plan /private/review-1.json`

2. After reviewing the request, explicitly disable sign-in and revoke refresh
   tokens:

   `node scripts/fulfill-account-deletion.cjs --uid TARGET_UID --mode disable --confirm TARGET_UID`

3. Wait at least **65 minutes** for already issued ID tokens to expire. The
   tool enforces this server-recorded grace period; no production bypass exists.
   Repeating step 2 restarts the grace period safely.
4. Generate a fresh private plan with a different filename. Inspect every
   removal and update, all referenced media generations and manual-review
   entries. The plan expires after 15 minutes. Unknown references must be
   reviewed and resolved individually before preparing another plan.
5. Execute only the explicitly reviewed fingerprint:

   `node scripts/fulfill-account-deletion.cjs --uid TARGET_UID --mode execute --plan /private/review-2.json --confirm TARGET_UID --fingerprint REVIEWED_FINGERPRINT`

The executor re-inventories the data, compares the fingerprint, checks disabled
Auth and the processing request, and uses exact Firestore update timestamps
and Storage generations. It preserves other accounts, other posts and the
other participant's messages, removes the deleted sender's messages, and
clears conversation previews/identity caches. A technical conversation ID can
remain for the other participant's retained messages.

On failure the tool does **not** mark success: partial completion needs a fresh
reviewed plan and retry. Related data is scanned again before Auth is deleted.
The deletion request is removed last. Remove all private plan copies securely
after the case is closed; do not leave them in backups or support archives.

Anonymous requests cannot always be attributed to an account. Requests with
no reliable account ownership and third-party text containing personal data
need a separate, documented rights review; never erase another account or
shared content based only on a matching common name or telephone number.

## Tests

`Verify Play release completion` runs the whole executor against the demo Auth,
Firestore and Storage emulators, including an orphaned subcollection. Unit
tests cover stale plans, missing consent, another account, UID prefix collisions,
changed media generations, unknown references and the grace-period guard.

Only the demo suite creates/deletes synthetic accounts. Production credentials
are not used by that suite. Do not run production deletion as a release test.
