# Deploying Forma inside app.wisdomcourse.com.et

Forma (the school management app) is deployed beside the Ethio Wellness Platform ("wa") so that
both are used from one domain:

| Address | Served by |
|---|---|
| `https://app.wisdomcourse.com.et/` and every other path | wa (unchanged) |
| `https://app.wisdomcourse.com.et/school` and everything under it | Forma |

wa shows a **School** tab that opens `/school`. The two applications stay separate: their own
code, releases, sign-in, and database tables. One can be updated or restarted without the other.

How it works on Plesk: Forma runs as its own Node.js application on a subdomain
(`school.wisdomcourse.com.et`), built so that all of its pages live under `/school`. One nginx rule
on `app.wisdomcourse.com.et` forwards `/school` requests to it. Visitors only ever see
`app.wisdomcourse.com.et/school`.

What has been checked: a `/school` release built on Windows was started with `node app.js` behind a
local stand-in for the nginx rule below (same forwarded headers), and sign-up, sign-in, sign-out,
form submissions (Server Actions), filters, links, and file upload/download all worked under
`/school`, while every other path went to the other app. What has not: the Plesk server itself.
Steps that depend on it are marked **check on the server**.

If Plesk does not let you add the nginx rule, use the subdomain instead (§8); everything else stays
the same.

## 1. Before you start

| You need | Notes |
|---|---|
| Plesk access to `wisdomcourse.com.et` | To add a subdomain, a Node.js app, and nginx directives. |
| MySQL 8.0+ | A new, empty database for Forma (recommended). See §4. |
| Node.js 20.9+ on the server | Plesk → Node.js shows 22.x: fine. |
| A mailbox for sending | e.g. `no-reply@wisdomcourse.com.et`. Invitations and password resets are emailed. |
| This repository on a Windows or Linux machine | With `npm install` done, to build the release. |

## 2. Build the release (on your computer)

```bash
npm run deploy:plesk
```

This builds Forma for `/school` and writes `plesk-release/` and `plesk-release.zip`. The prefix is
fixed into the build: `RELEASE.json` in the release shows it (`"basePath": "/school"`). To build for
a subdomain without a prefix instead, run `npm run deploy:plesk -- --base-path ""` (§8).

The release contains the compiled app, `app.js` (the start-up file), the database migrations, and
production-only scripts. No `.env` file is included; nothing is compiled on the server.

**Do not build Forma on this server.** Its system libraries are too old for the Next.js 16 and
Tailwind CSS 4 compilers (the build fails with ``GLIBC_2.29' not found`` and then
`Failed to load next.config.ts`). Always deploy a pre-built release, either as the zip or from the
`plesk-release` Git branch (§3, step 3). A release's `build` script only prints a message, so a host
that runs `npm run build` automatically does no harm.

To publish a release on the Git branch instead of (or as well as) the zip:

```bash
npm run deploy:plesk -- --branch plesk-release
git push origin plesk-release
```

## 3. Create the Forma application in Plesk

1. **Subdomain.** Plesk → Websites & Domains → *Add Subdomain* → `school` (on
   `wisdomcourse.com.et`). Document root: `school.wisdomcourse.com.et/public`.
2. **HTTPS.** On the subdomain: SSL/TLS Certificates → install a Let's Encrypt certificate.
3. **Get the release onto the server**, either way:
   - **Git (recommended):** Git → add the repository `https://github.com/abebetadesse/wa-push.git`,
     branch **`plesk-release`** (not `main`: `main` is source code and cannot be built on this
     server), deployment path `school.wisdomcourse.com.et`. Deploy. For updates, publish a new
     release to the branch and click *Deploy* (or *Pull updates*).
   - **Zip:** Files → open `school.wisdomcourse.com.et` → upload `plesk-release.zip` → *Extract
     files*.

   The folder should now contain `app.js`, `package.json`, `RELEASE.json`, `.next`, `public`,
   `drizzle`. `RELEASE.json` should show `"basePath": "/school"`.
4. **Node.js.** On the subdomain: Node.js → *Enable Node.js*, then set
   - Node.js version: 22.x
   - Application mode: `production`
   - Application root: `/school.wisdomcourse.com.et`
   - Document root: `/school.wisdomcourse.com.et/public`
   - Application startup file: `app.js`
5. **Dependencies.** Add the environment variable `NODE_ENV=production` (next section), then click
   *NPM install*. Over SSH the equivalent is `npm ci --omit=dev` in the application root.

## 4. Settings (environment variables)

Enter these in Node.js → *Custom environment variables* (or in a `.env` file in the application
root; never commit it).

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DATABASE` (percent-encode special characters) |
| `BETTER_AUTH_SECRET` | 32+ random characters. Generate: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `BETTER_AUTH_URL` | `https://app.wisdomcourse.com.et` — the public origin only, **without** `/school` |
| `UPLOAD_DIR` | An absolute path outside any document root, e.g. `/var/www/vhosts/wisdomcourse.com.et/forma-uploads`. Include it in backups. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | The mailbox's SMTP settings (Plesk → Mail → the mailbox → *Mail client settings*) |
| `EMAIL_FROM` | e.g. `Forma <no-reply@wisdomcourse.com.et>` |

Do not set `NEXT_PUBLIC_BASE_PATH` on the server; the release already contains `/school`.

**Database.** Create a dedicated MySQL database and user in Plesk → Databases and use it in
`DATABASE_URL`. Sharing wa's database is possible (the table names do not overlap and the two apps
keep separate migration histories), but a separate database keeps backups, restores, and
permissions independent. Forma's tables have no prefix option.

## 5. Create the tables and the first administrator

In Node.js → *Run script* (or over SSH in the application root):

1. `db:migrate` — creates or updates Forma's tables. Run it after every new release, before
   restarting. It prints `database is up to date (N migrations applied)`.
2. Create the platform administrator once, against the empty database. Over SSH it asks for the
   password twice without echoing it:
   ```bash
   npm run auth:create-admin -- --email admin@wisdomcourse.com.et --name "Platform Admin"
   ```
   Without SSH, add a temporary environment variable `PLATFORM_ADMIN_PASSWORD` (12+ characters),
   run the script `auth:create-admin -- --email admin@wisdomcourse.com.et --name "Platform Admin"`,
   then **delete the variable** and keep the password somewhere safe.
3. Click *Restart App*.

Check: open `https://school.wisdomcourse.com.et/school/api/health` (later also
`https://app.wisdomcourse.com.et/school/api/health`). It must show `"status":"ok"`. Otherwise it
lists, by name only, the settings that are missing or wrong, whether the database can be reached,
how many migrations are applied, and whether the upload folder is writable. Fix what it reports and
click *Restart App*. Then `https://school.wisdomcourse.com.et/school/login` shows the Forma sign-in
page. (Use the subdomain address only for these checks; users sign in at
`app.wisdomcourse.com.et/school`.)

The subdomain needs its own valid certificate (§3, step 2). Without it, browsers warn on the
subdomain address; the nginx rule in §6 still works because nginx does not verify it.

## 6. The nginx rule on app.wisdomcourse.com.et

Plesk → Websites & Domains → `app.wisdomcourse.com.et` → *Apache & nginx Settings* →
**Additional nginx directives**, add:

```nginx
# Forma school management, served from the school.wisdomcourse.com.et Node.js app.
location ^~ /school {
    proxy_pass https://school.wisdomcourse.com.et;
    proxy_ssl_server_name on;
    proxy_http_version 1.1;
    proxy_set_header Host school.wisdomcourse.com.et;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Connection "";
    # Pages stream in parts; pass them on as they arrive.
    proxy_buffering off;
    proxy_read_timeout 120s;
    # Learning resources can be up to 100 MB.
    client_max_body_size 110m;
}
```

Click *OK*. Plesk validates the directives before applying them; if it reports an error or the
field is not available on your plan, use §8.

Notes (**check on the server**):
- `proxy_pass` keeps the full path (`/school/...`), which is what the `/school` build expects. Do
  not add a trailing slash or path after the host name.
- nginx resolves `school.wisdomcourse.com.et` when it loads the configuration, so the subdomain's
  DNS record must exist first (Plesk creates it when its DNS service manages the domain). If the
  domain's DNS is managed elsewhere, add an `A` record for `school` pointing to the server.
- Uploads through the subdomain are also limited by its own nginx settings; if a large upload
  fails with `413`, add `client_max_body_size 110m;` to the subdomain's *Additional nginx
  directives* as well.

## 7. Check the integration

1. `https://app.wisdomcourse.com.et/` still shows wa, and its **School** tab is visible
   (wa must be rebuilt and redeployed with the tab, see below).
2. The tab opens `https://app.wisdomcourse.com.et/school/login`. Sign in as the platform
   administrator and create a school.
3. Invite a staff member from **Team**; the emailed link must start with
   `https://app.wisdomcourse.com.et/school/accept-invite`.
4. Request a password reset from the sign-in page; the emailed link must start with
   `https://app.wisdomcourse.com.et/school/api/auth/reset-password/`.
5. Upload a small file in **Resources** and open it.
6. Sign out, then confirm that `https://app.wisdomcourse.com.et/school/students` sends you to the
   sign-in page.

**wa's School tab.** The tab is in wa's `src/components/shell/Navbar.tsx` and links to
`NEXT_PUBLIC_SCHOOL_APP_URL` (default `/school`). Rebuild and redeploy wa as usual
(`npm run deploy:plesk` in the wa project) for the tab to appear.

**Sign-in.** Each app has its own accounts and sign-in. Signing in to wa does not sign you in to
Forma, and the reverse. Both apps' cookies are sent to the whole domain but neither app reads the
other's.

## 8. Fallback: Forma on its own subdomain

Use this when the nginx rule cannot be added.

1. Build without the prefix: `npm run deploy:plesk -- --base-path ""`.
2. Follow §3–§5, with `BETTER_AUTH_URL=https://school.wisdomcourse.com.et`.
3. Users open `https://school.wisdomcourse.com.et/` (the check address becomes
   `https://school.wisdomcourse.com.et/login`).
4. In wa, set `NEXT_PUBLIC_SCHOOL_APP_URL=https://school.wisdomcourse.com.et` before building, so
   the School tab points to the subdomain. Then rebuild and redeploy wa.

## 9. Updating Forma

GitHub Actions (`.github/workflows/ci-cd.yml`) does steps 1 and, when configured, 2 for you on every
push to `main`: it checks the code, builds the `/school` release on Linux, and publishes it to the
`plesk-release` branch. To also deploy automatically, copy the webhook URL from Plesk → Git → the
repository's settings and save it as the repository secret `PLESK_GIT_WEBHOOK_URL` (GitHub →
Settings → Secrets and variables → Actions). The workflow then triggers the server and waits until
`/school/api/health` reports the new release. Make sure the Plesk Git deployment's additional
actions run `npm ci --omit=dev`, `npm run db:migrate`, and a restart (e.g.
`mkdir -p tmp && touch tmp/restart.txt`). If GitHub cannot reach the server, the workflow says so
and you click *Deploy* in Plesk → Git instead.

To publish a release by hand:

1. `npm run deploy:plesk -- --branch plesk-release` on your computer, then
   `git push origin plesk-release`.
2. Plesk → Git → *Deploy* (or upload and extract the new zip over the application root). Your
   `.env`, if you used one, is not overwritten because the release does not contain one.
3. *NPM install* (only needed when dependencies changed), *Run script* → `db:migrate`, *Restart App*.

Back up the database and the `UPLOAD_DIR` folder before each update.

## 10. Before real student data

Use real student information only after: the production mail provider has delivered invitation and
password-reset links to a test inbox; sign-in, sign-out, invitation expiry, and role restrictions
have been checked on the server; and a privacy/security review appropriate for student records has
been completed.
