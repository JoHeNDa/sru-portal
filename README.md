# SRU membership portal: backend files

Merge these into a fresh Next.js 16 project (App Router, no src folder, "@/*" alias).
See the chat guide for the exact commands.

- supabase/schema.sql   run once in Supabase SQL Editor
- supabase/patch-1.sql  run once, after schema.sql (security fix and storage rules)
- supabase/patch-7-article-decline-reason.sql after patch 4 (adds the article moderation reason column)
- supabase/patch-8-article-engagement.sql after patch 7 (enables safe member comments, edits, likes and unlikes)
- supabase/patch-6-application-based-registration.sql after patches 1-5 (registration stays in applications until payment)
- supabase/patch-9-professional-join-fields-and-stats.sql after patch 6 (professional join details and designation aggregates)
- supabase/patch-10-committee-message.sql after the committee terms/content patches (committee messages and public committee data)
- supabase/patch-11-homepage-showcases.sql after patch-4-admin-content-crud.sql (admin-managed homepage showcase segments)
- supabase/patch-12-showcase-ad-labels.sql after patch 11 (optional showcase sub-labels)
- supabase/patch-13-public-committee-directory.sql after patch-10-committee-message.sql (public full committee history)
- .env.example          copy to .env.local and fill in. Never share or upload .env.local
- proxy.ts              keeps sign-in sessions fresh (called middleware.ts before Next.js 16)
- lib/                  Pesapal client, Supabase clients, payment confirmation
- app/api/pay           start a payment, receive Pesapal notifications
- app/join, app/payment/return, app/auth/callback   registration, return page, Google redirect
- components/GoogleOneTap.tsx   one-tap sign-in

## Production payments and deployment

The payment flow uses Pesapal. A registration stays in `applications` while payment is pending.
Only after the server verifies the transaction does `confirm_payment()` create the `members` row
and set its paid-through year.

Before enabling live payments:

1. Deploy the app with an HTTPS `APP_URL`.
2. Set the environment variables from `.env.example` in the Vercel project settings. Keep
   `SUPABASE_SERVICE_ROLE_KEY` and both Pesapal consumer credentials server-only; never use
   `NEXT_PUBLIC_` for them or commit them to source control.
3. Register `https://<your-domain>/api/pay/ipn` with Pesapal using GET notifications, then set
   its returned ID as `PESAPAL_IPN_ID`.
4. Add the deployed `/auth/callback` URL to the Supabase Auth redirect allowlist and configure
   the Google provider's authorized redirect URI in Supabase/Google.
5. Test registration, renewal, cancellation, delayed notifications, and payment confirmation
   with Pesapal sandbox credentials before setting `PESAPAL_ENV=live` and using production
   credentials.

Do not mark a member active manually or rely on the browser return URL alone. The server verifies
the merchant reference, amount, currency, and provider status before activating membership.
