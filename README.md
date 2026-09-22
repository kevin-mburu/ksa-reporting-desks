# KSA Reporting Desks (GitHub Pages + Convex)

Campus reporting for Finance, IT/Bio, Photo, Principal, and Admin.

## Session behaviour (switching desks)

| Situation | What happens |
|-----------|----------------|
| Same browser, **same role** | **No re-login** — session is stored in `localStorage` and resumes |
| **Admin** | Can open **every** desk without logging in again |
| Finance → IT (different role) | Must use an **IT** account (or admin). Message explains why |
| New browser / cleared storage | Login again |

So Photo does **not** automatically act as IT/Finance. Each desk checks **role**. Only **admin** is seamless across all pages.

## Publish to GitHub Pages

1. **Production Convex**
   ```bash
   npx convex deploy
   ```
   Copy the **production** deployment URL.

2. Set in `public/shared.js` (no trailing slash):
   ```js
   export const CONVEX_URL = "https://YOUR_PROD.convex.cloud";
   ```

3. **Staff**
   - Change demo passwords (`campus2026`).
   - Create real users from **Admin → Create staff** (finance / it / photo / principal per campus).

4. **Import issued letters** (SQL → JSON batches → `issued:bulkImport`) before reporting days.

5. **GitHub**
   - Push this repo.
   - Settings → Pages → deploy from branch, folder **`/public`** (or root if you only publish `public` contents).
   - Open the Pages URL → `finance.html` etc.

6. Smoke-test one campus: letter lookup → Assign → IT → Photo → Principal export CSV.

## Roles

| Role | Access |
|------|--------|
| finance | Assign / edit / delete register, campus CSV |
| it | Bio after Finance, campus CSV |
| photo | Photo after IT, campus CSV |
| principal | Own campus totals + **full** CSV (read-only) |
| admin | All campuses, import letters, create staff |

## Local dev

```bash
npm install
npx convex dev
npx serve public
```

## Not in this release

- Live Supabase sync (manual letter import is used; automate later)
- WhatsApp / eCitizen / OTP

## Security

- Never put Supabase **service_role** in HTML or GitHub Pages.
- Convex URL is public (client); rules are enforced in Convex functions by role + campus.
