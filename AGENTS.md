<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Buyer flow is public server functions in src/lib/public.functions.ts; SyncPay calls live only in src/lib/syncpay.server.ts — keeps credentials server-side.
- Payment status is always re-verified against the SyncPay API (polling + /api/public/syncpay/webhook), never trusted from webhook bodies — prevents fake "paid" calls.
- Media bucket is private (workspace blocks public buckets); public page serves signed URLs.
- First account to sign up gets the admin role via a DB trigger; admin edits go through the browser client under RLS.
