## Migration 0054: database setup fails
- What's wrong: The view references a nonexistent table.
- Why: Batch membership is stored on transaction_events instead.
- What it breaks: Fresh database setup stops at migration 0054.
- Fix: Check settlement_batch_id IS NULL instead.
- Verification: 0054 failed before the change and applied afterwards.


## Migration 0055: account insert uses incompatible schema
- What's wrong: The insert references nonexistent columns and an unsupported account kind.
- Why: It does not match chart_of_accounts as created in migration 0007.
- What it breaks: Database setup stops at migration 0055.
- Fix: Use id, name, and kind; follow the existing asset suspense convention.
- Verification: Pending migration rerun.
- Migration 0055 applied successfully after the change, and all remaining migrations through 0072 completed.
- A full fresh-database rerun is still pending.

## Local development: browser API requests blocked
- What: Login requests failed with a browser CORS error.
- Why: The website called port 3000 directly from port 5173,
  and the API response lacked the required CORS headers.
- Impact: Users could not log in through the local website.
- Fix: Added a Vite /v1 proxy and made the default API URL relative.
- Verification: Logged into the merchant dashboard successfully,
  including the OTP step.
Migration rerun verified: Running npm run migrate again completed successfully with 0 applied and 66 already up to date. A full fresh-database rerun remains pending.


Validation: npm run typecheck completed successfully. This checks types, not runtime behavior.

Fresh-database verification: all 66 migrations applied successfully to filspay_test.


## Refund without a reason fails after provider approval
- What: Successful refunds without a reason fail to save.
- Why: The helper explicitly inserts NULL, bypassing the database
  default 'unspecified' and violating its non-null check.
- Impact: Provider approval can occur before local recording fails,
  leaving the refund unrecorded locally.
- Fix: Use 'unspecified' when the optional reason is absent.
- Verification: Existing processor tests changed from 3 passed /
  7 failed to 10 passed / 0 failed.

  ## Refund without a reason fails to save
- What: Refunds without an optional reason fail database insertion.
- Why: Explicit NULL bypasses the 'unspecified' database default
  and violates the non-null check.
- Impact: Provider approval can occur before local recording fails.
- Fix: Use 'unspecified' when no reason is supplied.
- Verification: Processor tests improved from 3/10 to 10/10 passing.
  The route test also confirms the saved default reason.

## Refund ownership is not enforced
- What: Refund helpers look up transactions by ID without requiring
  them to belong to the requesting merchant.
- Why: The wrapper adopts the transaction's merchant ID instead
  of preserving the authenticated merchant's identity.
- Impact: Wiring the original helpers would allow cross-merchant
  refund requests.
- Fix: Scope both transaction lookups by merchant ID and preserve
  the requesting merchant ID.
- Verification: The API returns 404 for another merchant's transaction;
  no refund row is created.

## Refund limit includes money never collected
- What: Refundable money is calculated from the authorized amount.
- Why: Authorization can exceed the amount actually captured.
- Impact: Requests exceeding collected money can reach the provider.
- Fix: Calculate the remaining limit as captured minus refunded fils.
- Verification: With 10,000 authorized and 7,000 captured, the API
  rejects a 7,001-fils refund with 422 and creates no refund row.

## Implement POST /v1/refunds
- Previous behavior: The endpoint always returned 501.
- Change: Connect validated requests to initiateMerchantRefund,
  using authenticated merchant identity and the client's
  idempotency key. Restrict access to owner/finance or API-key
  actors, and explicitly reject admin impersonation.
- Verification: All 11 transaction route tests pass, including a
  successful 3,000-fils partial refund and updated refunded total.
- Remaining work: Concurrency, role rejection tests, retry tests,
  fee edge cases, settlement, webhook delivery, UI, and reporting.

  ## Concurrent refunds exceed captured money
- What: Two simultaneous 6,000-fils refunds against a 10,000-fils
  payment both reached the provider and were approved.
- Why: Validation and recording used separate database transactions,
  allowing both requests to read the same refundable balance.
- Impact: Excess money can be refunded and local totals can be wrong.
- Fix: Use one database transaction with a merchant-scoped
  SELECT FOR UPDATE lock through validation, provider call, and recording.
- Verification: The reproduction failed before the fix with 12,000 fils
  approved. Afterwards, all 22 processor and route tests passed;
  only one refund succeeded and recorded totals matched.
- Limitation: Holds a database connection during the provider call.
  Recovery after external approval followed by database failure
  is not yet addressed.



  ## Partial refunds lose fee rounding residue
- What: Refunding 100 fils in two 50-fils parts reversed 0 fils
  of an original 1-fil fee.
- Why: Each partial fee was rounded independently.
- Impact: A fully refunded payment can retain an incorrect fee.
- Fix: Calculate cumulative fee reversal entitlement, then subtract
  fees already reversed, inside the locked refund transaction.
- Verification: The new regression test failed with 0 instead of 1
  before the fix. All 23 processor and route tests now pass.

  ## Enable refund webhook delivery
- What: refund.succeeded events were excluded from dispatch and had
  no public envelope mapping.
- Impact: Merchants received no refund notification.
- Change: Added explicit refund envelope fields and enabled dispatch.
- Verification: All 9 dispatcher tests pass, including refund payload,
  successful delivery, and no resend after success.
- Limitation: Raw-byte signature correctness remains unverified.

## Stabilize backoff test
- The test expected an exact delay while using random jitter.
- Supplied midpoint jitter for exact-value assertions.
- Production backoff behavior is unchanged.
## Deployment preparation (separate working copy)
- Added missing Node/Go build files and a static frontend gateway image.
- Added production Compose with a private database network, no published
  database/internal API ports, persistent storage, restart policies,
  and the required API cap of 0.5 CPU / 512 MB.
- Admin router now uses Vite's BASE_URL, allowing the built console under
  /admin/ while retaining its original development routes at base /.
- Generated secrets are private server files, excluded from Git/builds.
- Normal redeploy leaves the settlement daemon running; settlement binary
  upgrades need a separate reviewed maintenance operation.
- Verified: TypeScript check, both frontend production builds, production
  Compose validation, and 32 targeted refund/route/dispatcher tests passed.
- Unverified: Linux image builds, hosted login, TLS reverse proxy, actual
  container resource limits, capacity and overload recovery. Full refund
  settlement/reporting integration remains incomplete.
- Production OTP delivery is still a blocker: the supplied notifier does
  not send email/SMS. The deployment does not expose OTPs to the browser.
- No claim of database role separation or database TLS: services still
  share a database role over an isolated internal Docker network.

### Broader baseline test run
The workspace test run passed events (4), money (40), API (366), and web (8)
checks, but reporting had 4 failures out of 11 with null merchant_id in
merchant_daily_volume. This run reused the test database after targeted tests,
so fixture contamination versus a reporting defect still needs isolation.
Do not claim the whole suite passed. Go tests are not yet run.
