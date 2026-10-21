# Deploying Forma at school.wisdomcourse.com.et

Forma (the school management app) runs as its own website at **`https://school.wisdomcourse.com.et`**,
on its own Node.js application in Plesk. It does not depend on the Ethio Wellness Platform ("wa") or
any other site: it has its own code, releases, database, sign-in, and settings.

To move all apps to a new server and database service, follow [MIGRATION.md](MIGRATION.md).

To serve Forma at `https://www.wisdomcourse.com.et/school` alongside the other apps, with a portal
page at `/apps`, follow [SINGLE-DOMAIN.md](SINGLE-DOMAIN.md).

The release is served from the site root (`/login`, `/students`, `/api/health`, ...). The code still
supports serving under a path of another domain (`NEXT_PUBLIC_BASE_PATH`, `--base-path /school`), but
that is not used in production.

## 1. Before you start

| You need | Notes |
|---|---|
| Plesk access to `wisdomcourse.com.et` | To manage the `school` subdomain, its Node.js app, Git, and certificate. |
| MySQL 8.0+ | A dedicated, empty database for Forma. See §4. |
| Node.js 20.9+ on the server | Plesk → Node.js shows 22.x: fine. |
| A mailbox for sending | e.g. `no-reply@wisdomcourse.com.et`. Invitations and password resets are emailed. |

**Do not build Forma on this server.** Its system libraries are too old for the Next.js 16 and
Tailwind CSS 4 compilers (the build fails with ``GLIBC_2.29' not found``). The server only runs
pre-built releases from the `plesk-release` Git branch. A release's `build` script only prints a
message, so a host that runs `npm run build` automatically does no harm.

## 2. How releases are made

GitHub Actions (`.github/workflows/ci-cd.yml`) checks every push and pull request. On every push to
`main` it builds the release on Linux and publishes it to the **`plesk-release`** branch of
`https://github.com/abebetadesse/wa-push`. `RELEASE.json` in the release names the commit it was built
from and shows `"basePath": "/"`.

To build a release on your own computer instead:

```bash
npm run deploy:plesk -- --branch plesk-release
git push origin plesk-release
```

(`npm run deploy:plesk` alone writes `plesk-release.zip` for uploading by hand.)

## 3. The application in Plesk

1. **Subdomain.** Websites & Domains → `school.wisdomcourse.com.et` (create it with *Add Subdomain*
   if it does not exist). Document root: `school.wisdomcourse.com.et/public`.
2. **HTTPS.** On the subdomain: SSL/TLS Certificates → Let's Encrypt certificate, and turn on
   *Redirect from http to https*. Sign-in cookies are only sent over HTTPS.
3. **Git.** Git → repository `https://github.com/abebetadesse/wa-push.git`, branch
   **`plesk-release`** (never `main`, which is source code), deployment path the application root
   (`/school.wisdomcourse.com.et`). Additional deployment actions:
   ```bash
   export PATH=/opt/plesk/node/22/bin:$PATH
   npm ci --omit=dev
   npm run db:migrate
   rm -rf .next/server/route-cache
   mkdir -p tmp && touch tmp/restart.txt
   ```
   (Adjust the Node.js path if your Plesk shows a different one under Node.js.)
   `.next/server/route-cache` holds pages Next.js rendered at run time. Git never removes it, so a
   new release would keep serving the previous build's pages (and their old `/_next/...` asset
   URLs, which then fail to load). `app.js` also empties it when it starts a different build.
4. **Node.js.** On the subdomain: Node.js → *Enable Node.js*:
   - Node.js version: 22.x
   - Application mode: `production`
   - Application root: `/school.wisdomcourse.com.et`
   - Document root: `/school.wisdomcourse.com.et/public`
   - Application startup file: `app.js`
5. **If you added the earlier nginx rule** (`location ^~ /school { ... }`) to
   `app.wisdomcourse.com.et`, remove it from that domain's *Apache & nginx Settings → Additional
   nginx directives*. It is no longer used.
6. **Large uploads.** Learning resources can be up to 100 MB. If an upload fails with `413`, add
   `client_max_body_size 110m;` to the subdomain's *Additional nginx directives*.

## 4. Settings (environment variables)

Enter these in the subdomain's Node.js → *Custom environment variables* (or in a `.env` file in the
application root; it is never part of a release, so deployments do not overwrite it).

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `BETTER_AUTH_URL` | `https://school.wisdomcourse.com.et` (no path, no trailing slash) |
| `BETTER_AUTH_SECRET` | 32+ random characters, unique to Forma. Generate: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DATABASE` (percent-encode special characters) |
| `UPLOAD_DIR` | Optional. An absolute path outside the document root, e.g. `/data/dom/afri.net.et/forma-uploads`. Defaults to `var/uploads` in the application root. Include it in backups. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | The sending mailbox's SMTP settings (Plesk → Mail → the mailbox → *Mail client settings*) |
| `EMAIL_FROM` | e.g. `Forma <no-reply@wisdomcourse.com.et>` |

Do not set `NEXT_PUBLIC_BASE_PATH` on the server.

**Database.** Create a dedicated MySQL database and user for Forma in Plesk → Databases, so its
data, backups, and permissions are independent of any other application.

## 5. Tables, first administrator, and check

1. Click *Restart App* after saving the settings.
2. Node.js → *Run script* → `db:migrate` (it prints `database is up to date (N migrations applied)`).
   The Git deployment actions also run it on every release.
3. Create the platform administrator once, against the empty database. Over SSH (asks for the
   password twice without echoing it):
   ```bash
   npm run auth:create-admin -- --email admin@wisdomcourse.com.et --name "Platform Admin"
   ```
   Without SSH: add a temporary environment variable `PLATFORM_ADMIN_PASSWORD` (12+ characters),
   *Run script* `auth:create-admin -- --email admin@wisdomcourse.com.et --name "Platform Admin"`,
   then **delete the variable**, keep the password somewhere safe, and *Restart App*.
4. Open **`https://school.wisdomcourse.com.et/api/health`**. It must show `"status":"ok"`. Otherwise
   it lists, by name only, the settings that are missing or wrong, whether the database can be
   reached, how many migrations are applied, and whether uploads can be saved. Fix what it reports,
   *Restart App*, and reload.
5. Open `https://school.wisdomcourse.com.et/`, sign in as the platform administrator, and create a
   school.

## 6. Check the live site

1. `https://school.wisdomcourse.com.et/api/health` shows `"status":"ok"` and the release commit.
2. Sign in and out; `https://school.wisdomcourse.com.et/students` sends a signed-out visitor to the
   sign-in page.
3. Invite a staff member from **Team**; the emailed link starts with
   `https://school.wisdomcourse.com.et/accept-invite`.
4. Request a password reset; the emailed link starts with
   `https://school.wisdomcourse.com.et/api/auth/reset-password/`.
5. Upload a small file in **Resources** and open it.

## 7. Updating Forma

Every push to `main` publishes a new release to `plesk-release` automatically. Then:

- **Manual:** Plesk → Git → *Deploy* (or *Pull updates*). The deployment actions install
  dependencies, migrate, and restart.
- **Automatic:** copy the repository's webhook URL from Plesk → Git and save it in GitHub → Settings
  → Secrets and variables → Actions as the secret **`PLESK_GIT_WEBHOOK_URL`**. Each release then
  triggers the server, and the workflow waits until `https://school.wisdomcourse.com.et/api/health`
  reports the new release. If GitHub cannot reach the server, the run says so; click *Deploy*.

Back up the database and the upload folder before each update.

## 8. Before real student data

Use real student information only after: the production mail provider has delivered invitation and
password-reset links to a test inbox; sign-in, sign-out, invitation expiry, and role restrictions
have been checked on the server; and a privacy/security review appropriate for student records has
been completed.
