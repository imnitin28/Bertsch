# Finance Tracker (Netlify version)

A static frontend + Netlify Functions backend for turning an annual
income/expense list into a 12-sheet (January-December) report with running
totals. Fully stateless — nothing is stored on the server between requests,
which is what makes it deployable on Netlify.

## How it differs from a "normal" server app

- **Input** doesn't check for / persist a file on the server. Clicking
  **Generate new Excel sheet** always creates and downloads a fresh
  template. You keep and fill in that file yourself.
- **Output** takes the file you upload, processes it in-memory inside a
  serverless function, and streams the result straight back for download.
  Nothing is written to disk.
- **Login** issues a signed JWT (JSON Web Token) instead of a server-side
  session, since serverless functions don't keep state between calls. The
  token is stored in the browser (`localStorage`) and sent with each
  request.

## Project structure

```
public/                      Static frontend (served directly by Netlify)
  index.html                  Redirects to /login.html or /dashboard.html
  login.html
  dashboard.html
  input.html
  output.html
  app.js                       Shared JS: auth token handling, API calls
  style.css
netlify/functions/
  login.js                     POST /api/login          -> { token, email }
  generate-input.js            GET  /api/generate-input  -> { filename, dataBase64 }
  process-output.js            POST /api/process-output  -> { filename, dataBase64 }
  lib/
    auth.js                    Hardcoded users + JWT issue/verify
    excel-engine.js             Template creation + input->output transform (exceljs)
netlify.toml                  Build + redirect config
package.json
```

## 1. Configure before deploying

**Edit the hardcoded users** in `netlify/functions/lib/auth.js`:

```js
const USERS = {
  "user1@example.com": "password123",
  "user2@example.com": "password456",
};
```

**Set a real JWT secret.** Don't rely on the fallback in `auth.js` — set an
environment variable in Netlify:

- Netlify UI: Site configuration → Environment variables → add `JWT_SECRET`
  with a long random value.
- Or via CLI: `netlify env:set JWT_SECRET "$(openssl rand -hex 32)"`

## 2. Deploy

### Option A — Netlify UI (no CLI needed)
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build settings are already in `netlify.toml` (publish dir `public`,
   functions dir `netlify/functions`) — Netlify will detect them
   automatically.
4. Add the `JWT_SECRET` environment variable (see above) before the first
   deploy, or add it and trigger a redeploy afterwards.
5. Deploy. Netlify installs `package.json` dependencies (`exceljs`,
   `jsonwebtoken`) automatically as part of the functions build.

### Option B — Netlify CLI
```bash
npm install -g netlify-cli
cd finance_app_netlify
netlify login
netlify init            # link or create a site
netlify env:set JWT_SECRET "$(openssl rand -hex 32)"
netlify deploy --prod
```

### Local development
```bash
npm install
netlify dev
```
This runs the static site and the functions together on one local URL
(usually `http://localhost:8888`), matching production routing
(`/api/*` → `/.netlify/functions/*` per `netlify.toml`).

## Frequency codes (same as before)

| Code | Meaning                 | How it repeats                                 |
|------|--------------------------|-------------------------------------------------|
| A    | Annuel (yearly)          | Once, in the month of the given date            |
| M    | Mensuel (monthly)        | Every month (12x/year), same day-of-month       |
| T    | Trimestriel (quarterly)  | Every 3 months (4x/year)                        |
| B    | Bimestriel (every 2mo)   | Every 2 months (6x/year)                        |
| H    | Hebdomadaire (weekly)    | Every week of that date's year, same weekday    |

Adjust `expandRow()` in `netlify/functions/lib/excel-engine.js` if your
real-world rules for T/B differ — the sample data only exercised A, M, H.

## Notes

- Uploaded files must be `.xlsx`, under a few MB (Netlify Functions have a
  ~6 MB synchronous request/response limit) — plenty for a personal
  expense sheet.
- JWTs expire after 12 hours; users just log in again after that.
- This still isn't hardened for public/production use with sensitive data
  (e.g. no rate limiting on login) — fine for personal/small-team use.
