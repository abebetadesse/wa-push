# Moving all apps to the new server and database

A step-by-step plan for moving NiniMed, Forma (school), Ethiopian Wisdom (app), Family Feud (feud)
and VERITAS AI (paraphrase) from the old Ethio Telecom hosting (`lin3.ethiotelecom.et`, database
`mysql-db02.remote`) to your new server and database service.

The plan keeps the old sites running until the new ones are tested, then switches over by changing
DNS, so visitors see little or no downtime and you can switch back at any point before step 9.

| Phase | Steps | Visitors notice |
|---|---|---|
| Prepare | 1–3 | nothing |
| Copy data | 4–5 | nothing |
| Set up apps on the new server | 6–7 | nothing |
| Test privately | 8 | nothing |
| Switch over | 9–10 | a few minutes while DNS updates |
| Clean up | 11 | nothing |

> **Good news about timing.** The old database is read-only, so nothing can change in it during the
> move. An export taken now is complete, and you don't need a "freeze" window.

## 1. Collect what you need

Write these down before starting (keep passwords in a password manager, not in documents):

- **New server:** its IP address, how you log in (Plesk panel, cPanel, or SSH), and its operating
  system. A Linux server with **Node.js 22**, **nginx**, and a recent OS (Ubuntu 22.04/24.04,
  AlmaLinux 9, Debian 12) is what these apps need.
- **New database service:** host name, port, and an administrator user that can create databases
  and users. It must be **MySQL 8.0+** (or MariaDB 10.11+ if MySQL is not offered).
- **Old hosting access:** Plesk at `https://lin3.ethiotelecom.et:8443` (File Manager and phpMyAdmin
  still work; only database writes are blocked).
- **Domain DNS:** where `wisdomcourse.com.et`'s DNS records are managed (the registrar, the old
  Plesk, or a DNS provider). You will change its records in step 9.
- **Email:** whether your mailboxes (for example `no-reply@wisdomcourse.com.et`) are hosted on the
  old Plesk server. If they are, **do not change the MX records** in step 9, or decide where mail
  moves first.

## 2. Lower the DNS TTL (a day ahead)

Where the DNS is managed, set the TTL of these records to **300 seconds** (5 minutes):
`wisdomcourse.com.et`, `www`, `school`, `app`, `feud`, `paraphrase`. Do it at least 24 hours before
step 9 so the switch takes effect in minutes instead of hours.

## 3. Prepare the new server

### If the new server has Plesk

1. Add the domain `wisdomcourse.com.et` and the subdomains `school`, `app`, `feud`, `paraphrase`
   (Websites & Domains → Add Domain / Add Subdomain). Plesk may warn that DNS points elsewhere;
   that is expected until step 9.
2. On each, enable **Node.js** (version 22), the same way they are set up on the old server.
3. SSL certificates come in step 10 (Let's Encrypt needs DNS to point at the new server).

### If the new server is a plain Linux VPS (no control panel)

Over SSH, install the basics (Ubuntu shown):

```bash
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx
```

Create one folder per app, for example `/srv/forma`, `/srv/ninimed`, `/srv/app`, `/srv/feud`,
`/srv/paraphrase`. Each app will run under PM2 on its own local port, behind nginx (step 7).

## 4. Create the new databases

Give **each app its own database and user**. Sharing one database caused the problems on the old
server (one app's migrations renamed another app's tables, including the session table that broke
Forma's sign-in).

In the new database service, create:

| Database | User | For |
|---|---|---|
| `forma` | `forma_app` | Forma (school) |
| `ninimed` | `ninimed_app` | NiniMed |
| `wisdom_app` | `wisdom_app` | Ethiopian Wisdom |
| `feud` | `feud_app` | Family Feud (if it uses a database) |
| `paraphrase` | `paraphrase_app` | VERITAS AI (if it uses a database) |

Use a long random password for each user, give each user full rights **only on its own database**,
and allow connections from the new server's IP address.

Use the `utf8mb4` character set with the `utf8mb4_unicode_ci` collation.

## 5. Export the old data and import it

### 5a. Find which tables belong to which app

On the old Plesk → Databases → `afriet_` → phpMyAdmin, list the tables (318 in October 2026). They
are named by app:

- **Forma:** every table starting with `school_` (`school_schools`, `school_students`, …), plus
  `school_drizzle_migrations`.
- **The other apps:** the remaining tables. Check each app's code or its developer to confirm which
  tables it uses.

Two tables need care:

- `school_auth_sessions` is **not** Forma's (it is another app's session table, renamed into
  Forma's name by an old migration). **Do not copy it to Forma's new database**; Forma creates its
  own on start. Copy it to the app that owns it only if that app needs old sessions (it usually
  doesn't — users just sign in again).
- `school_auth_users` holds the user accounts Forma signs in with. Before copying, confirm in
  phpMyAdmin that it contains Forma's users (your super admin `abebetadesse1@gmail.com`), and check
  whether the other app expected a table called `auth_users` (it may have been renamed into Forma's
  name the same way). If so, that app's users need copying back under its own name.

### 5b. Export

In phpMyAdmin → `afriet_` → **Export** → **Custom**:

1. For Forma, select all `school_*` tables **except** `school_auth_sessions` (and the
   `school_auth_sessions_foreign_*` backup if it exists). Format **SQL**. Under object creation,
   tick **Add DROP TABLE** and **IF NOT EXISTS**. Export to a file such as `forma.sql`.
2. Repeat for each other app's tables (`ninimed.sql`, `wisdom_app.sql`, …).

For very large databases, phpMyAdmin may time out; with SSH access to any machine that can reach
the old database, use `mysqldump` instead:

```bash
mysqldump --no-tablespaces --single-transaction -h mysql-db02.remote -P 32636 -u USER -p afriet_ \
  $(tables for one app) > forma.sql
```

### 5c. Import

In the new database service's phpMyAdmin (or with `mysql -h NEWHOST -u forma_app -p forma < forma.sql`),
import each file into its own database. Check the table counts match the old ones.

## 6. Copy the uploaded files

Forma stores uploaded learning resources on disk, not in the database:

- On the old server, Plesk → File Manager → the Forma app folder (`school.wisdomcourse.com.et`) →
  `var/uploads` (or the folder in its `UPLOAD_DIR` setting). Download it as a ZIP (select → Archive →
  Add to archive, then download).
- On the new server, put it at `var/uploads` inside the new Forma app folder, or wherever you point
  `UPLOAD_DIR`.

Do the same for any upload or media folders the other apps have (check each app's settings).

## 7. Install the apps on the new server

### Forma

Forma ships as a ready-built release on the `plesk-release` branch of
`https://github.com/abebetadesse/wa-push`; the new server only downloads and runs it.

**With Plesk:** on `school.wisdomcourse.com.et` → **Git**, add the repository with branch
`plesk-release` and the app root as deployment path. Deployment actions:

```bash
npm ci --omit=dev
mkdir -p tmp && touch tmp/restart.txt
```

Node.js settings: Node 22, application mode `production`, startup file **`app.js`**.

**On a plain VPS:**

```bash
cd /srv && git clone --branch plesk-release https://github.com/abebetadesse/wa-push.git forma
cd /srv/forma && npm ci --omit=dev
PORT=3001 pm2 start app.js --name forma && pm2 save && pm2 startup
```

**Settings** (Plesk → Node.js → environment variables, or `/srv/forma/.env`):

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://forma_app:PASSWORD@NEWHOST:3306/forma` (percent-encode special characters in the password) |
| `BETTER_AUTH_URL` | the public address Forma will have: `https://school.wisdomcourse.com.et`, or `https://www.wisdomcourse.com.et` if you use the single-domain setup |
| `BETTER_AUTH_SECRET` | the old value, or a new 32+ character one (a new one only signs everyone out; invitation and reset links live in the database and keep working) |
| `UPLOAD_DIR` | only if the uploads are not in `var/uploads` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | your mailbox's outgoing (SMTP) settings — needed for invitations and password resets |

On start Forma applies its migrations and creates its own session table. Then open
`/api/health` (step 8): every section should say `ok`.

If the super admin's password is unknown after the move, reset it on the server:

```bash
npm run auth:ensure-admin -- --email abebetadesse1@gmail.com --name "Abebe Tadesse"
```

(it asks for the new password twice; with Plesk use **Node.js → Run script** and the
`PLATFORM_ADMIN_PASSWORD` variable, then delete that variable).

### NiniMed, Ethiopian Wisdom, Family Feud, VERITAS AI

For each app, the same pattern:

1. Get its code or release onto the new server (Git in Plesk, or `git clone` on a VPS).
2. Install its dependencies and build it if it isn't pre-built (`npm ci`, `npm run build`).
3. Set its settings: its **own** `DATABASE_URL` pointing at its new database, its public URL, and
   any API keys it uses (for example VERITAS AI's AI-provider key).
4. Start it (Plesk Node.js, or `pm2 start` on its own port: NiniMed 3000, Forma 3001,
   app 3002, feud 3003, paraphrase 3004).

Family Feud was down (503) on the old server on 21 October; check its logs on the new server after
starting it.

### nginx on a plain VPS

One `server` block per site, each forwarding to its app's port. For example
`/etc/nginx/sites-available/school.wisdomcourse.com.et`:

```nginx
server {
    listen 80;
    server_name school.wisdomcourse.com.et;
    client_max_body_size 110m;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
```

Repeat for `www.wisdomcourse.com.et` (with `server_name wisdomcourse.com.et www.wisdomcourse.com.et;`
→ port 3000), `app` (3002), `feud` (3003) and `paraphrase` (3004). Enable them with
`sudo ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`.

To serve everything from `www.wisdomcourse.com.et` with the portal at `/apps`, follow
[SINGLE-DOMAIN.md](SINGLE-DOMAIN.md) on the new server instead — it is simpler there, since a plain
nginx has no Passenger to switch off.

## 8. Test privately before switching

Make **your own computer** use the new server while everyone else still uses the old one.

On Windows, open Notepad **as administrator**, open `C:\Windows\System32\drivers\etc\hosts`, and add
(with the new server's IP):

```
NEW.SERVER.IP  wisdomcourse.com.et www.wisdomcourse.com.et school.wisdomcourse.com.et
NEW.SERVER.IP  app.wisdomcourse.com.et feud.wisdomcourse.com.et paraphrase.wisdomcourse.com.et
```

Your browser will warn about the certificate until step 10 (you can continue past it for testing,
or test on `http://`). Then check:

- **Forma:** `https://school.wisdomcourse.com.et/api/health` shows `"status":"ok"`, including
  `"auth": {"ok": true, "sessionWrite": {"ok": true}}`. Sign in as the super admin, open Students,
  Lessons and Resources (open an uploaded file), and create and delete a test record.
- **Each other app:** its home page loads, sign-in works, and creating data works (the new
  database accepts writes).

Remove the two lines from `hosts` when done.

## 9. Switch over

Where the DNS is managed, change the **A records** of `wisdomcourse.com.et`, `www`, `school`, `app`,
`feud` and `paraphrase` to the new server's IP (and any **AAAA** records to its IPv6 address, or
delete them). **Leave the MX records alone** unless mail is moving too.

Within about 5 minutes (thanks to step 2) visitors reach the new server. Check from a phone on
mobile data too, which uses different DNS.

## 10. Certificates and final checks

- **Plesk:** each domain → **SSL/TLS Certificates** → Let's Encrypt, then turn on
  *Redirect from http to https*.
- **Plain VPS:** `sudo certbot --nginx -d wisdomcourse.com.et -d www.wisdomcourse.com.et -d school.wisdomcourse.com.et -d app.wisdomcourse.com.et -d feud.wisdomcourse.com.et -d paraphrase.wisdomcourse.com.et`

Then repeat the checks from step 8 without the `hosts` entries. For Forma, also send yourself an
invitation and a password reset, and confirm the emailed links open on the right address.

Point Forma's automatic deployment at the new server: in the new Plesk → `school…` → Git, copy the
**webhook URL** and save it in GitHub → repository → Settings → Secrets and variables → Actions as
`PLESK_GIT_WEBHOOK_URL`. (On a plain VPS, run `cd /srv/forma && git pull && npm ci --omit=dev && pm2 restart forma`
after each release, or ask for an automated deploy job.)

## 11. Clean up (after a week of normal running)

- Take a final backup of the old database and files and keep it somewhere safe.
- Set the DNS TTL back to 3600 or more.
- Cancel the old hosting only after confirming nothing still uses it (mail, other domains).
- Set up regular backups on the new service: a daily database backup and a copy of each app's
  upload folder.

## Going back

Until the old hosting is cancelled, you can return at any time by pointing the DNS A records back to
the old server's IP. The old database is read-only, though, so the old sites cannot save anything —
switching back only makes sense for reading.
