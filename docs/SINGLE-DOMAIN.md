# Serving apps from one domain

Use `https://www.wisdomcourse.com.et` as the single public address. The root is an app portal with
dedicated buttons; each app has its own path:

| App | Public URL |
|---|---|
| App portal | `https://www.wisdomcourse.com.et/` (`portal/index.html`) |
| Forma — School management | `https://www.wisdomcourse.com.et/school` |
| NiniMed | `https://www.wisdomcourse.com.et/health` |
| Family Feud | `https://www.wisdomcourse.com.et/feud` |
| VERITAS AI | `https://www.wisdomcourse.com.et/paraphrase` |
| Ethiopian Wisdom | `https://www.wisdomcourse.com.et/wa` |

NiniMed runs as the `www` site's Plesk Passenger app. Its Next.js middleware serves the portal at
`/`, rewrites `/health` to NiniMed internally, and redirects its legacy root-relative URLs under
`/health`. No custom nginx rule is needed for the portal and NiniMed paths.

`https://wisdomcourse.com.et` currently redirects to `www`; keep that redirect so both hostnames
land on the same canonical URLs and cookies are not split between them.

## If nginx settings are unavailable

The NiniMed GitHub Actions deployment can serve the portal at `/` and NiniMed at `/health` from
the same Passenger app using Next.js middleware; it does not need a custom nginx directive. The
portal links for Forma, Family Feud, VERITAS AI, and Ethiopian Wisdom redirect to their current
app subdomains for now. GitHub Actions can deploy app code, but it cannot make separate hosting
processes answer under one domain's path prefixes. Serving every app at `/school`, `/feud`,
`/paraphrase`, and `/wa` still requires a host-level reverse proxy or consolidating those apps
behind one application server.

## How it works

The public URLs use one domain, while each app can continue running as its own application and
release. The backend hostnames below are internal proxy destinations; visitors use the path URLs
in the table above, not the app subdomains.

1. **nginx serves the portal at `/`**, proxies the independently hosted apps, and routes NiniMed
   through the existing Passenger app under `/health`.
2. **Each app must support its path**, including links, API routes, callbacks, cookies, and static
   assets (for example, `/school/_next/...`). A reverse proxy alone cannot make an app path-aware.
3. **Old app hostnames can redirect to the new path URLs.** Proxy requests carry an
   `X-Wisdom-Portal` header so those redirects do not loop.
4. **Database consolidation is separate from URL consolidation.** A table prefix prevents name
   collisions only within the same database engine; it cannot make PostgreSQL and MySQL share one
   schema. See the database compatibility section before planning data migrations.

> **Do the steps in order, one app at a time.** If an app is rebuilt for its path before `www`
> forwards that path, its subdomain shows a broken page.

## Before you start

- **Database compatibility is resolved by keeping NiniMed separate.** NiniMed uses PostgreSQL
  (`postgres-js` and Drizzle's PostgreSQL schema); Forma, Family Feud, Ethiopian Wisdom, and
  VERITAS AI's account store use MySQL. Keep NiniMed on PostgreSQL. The other MySQL apps can share
  a MySQL schema with distinct prefixes; prefixes cannot combine PostgreSQL and MySQL.
- **Protect clinical data.** NiniMed handles healthcare data. Combining it with unrelated apps in
  one schema removes database-level isolation; use a separate database and credentials unless the
  security, privacy, backup, and regulatory requirements have been reviewed and explicitly
  approved.
- **Cookies are shared by every app on one domain.** Give every app a unique cookie name/prefix and
  review cookie `Path`, `Secure`, `SameSite`, and authentication callback settings. Forma uses the
  `forma` prefix (`advanced.cookiePrefix` in `src/lib/auth.ts`). Separate databases do not create
  shared sign-in (SSO).
- **Find the domain's folder on the server.** Plesk → **Websites & Domains** → `wisdomcourse.com.et`
  → **Hosting & DNS → Hosting**: the document root is shown there, usually
  `/var/www/vhosts/wisdomcourse.com.et/httpdocs`. Below, `/var/www/vhosts/wisdomcourse.com.et`
  stands for the part before `/httpdocs`; replace it if yours differs.

## 1. Serve the portal at the root

1. Copy `portal/index.html` from this repository to a location outside the app document root, for
   example `/var/www/vhosts/wisdomcourse.com.et/portal/index.html`.
2. The `apps` list in the file defines each dedicated button's name, path, category, icon, and
   description.

Upload the portal file before changing the routing. The nginx rule below serves it at `/` and
`/apps` redirects to `/`. NiniMed stays on the existing Passenger handler and is built for
`/health`. Apply the root rule and `/health` compatibility routing together; do not switch the
portal to `/` until the portal file is present. `/health` is only fully functional after the new
NiniMed release is running.

## 2. Forward the paths on www.wisdomcourse.com.et

Plesk → `wisdomcourse.com.et` (the domain that serves `www`) → **Apache & nginx Settings** →
**Additional nginx directives**. Add:

Install each independent app's proxy block only after that upstream supports the matching path
prefix and has passed a direct test. NiniMed remains on Passenger; the complete example below
shows the intended final routing.

```nginx
# App portal
location = / {
    passenger_enabled off;
    default_type text/html;
    alias /var/www/vhosts/wisdomcourse.com.et/portal/index.html;
}
location = /apps { return 301 /; }
location = /apps/ { return 301 /; }

# Forma — school management
location ~ ^/school(/|$) {
    passenger_enabled off;
    proxy_pass https://school.wisdomcourse.com.et;
    proxy_ssl_server_name on;
    proxy_set_header Host school.wisdomcourse.com.et;
    proxy_set_header X-Wisdom-Portal 1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
    client_max_body_size 110m;   # learning resources up to 100 MB
}

# Family Feud
location ~ ^/feud(/|$) {
    passenger_enabled off;
    proxy_pass https://feud.wisdomcourse.com.et;
    proxy_ssl_server_name on;
    proxy_set_header Host feud.wisdomcourse.com.et;
    proxy_set_header X-Wisdom-Portal 1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}

# VERITAS AI
location ~ ^/paraphrase(/|$) {
    passenger_enabled off;
    proxy_pass https://paraphrase.wisdomcourse.com.et;
    proxy_ssl_server_name on;
    proxy_set_header Host paraphrase.wisdomcourse.com.et;
    proxy_set_header X-Wisdom-Portal 1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}

# Ethiopian Wisdom
location ~ ^/wa(/|$) {
    passenger_enabled off;
    proxy_pass https://app.wisdomcourse.com.et;
    proxy_ssl_server_name on;
    proxy_set_header Host app.wisdomcourse.com.et;
    proxy_set_header X-Wisdom-Portal 1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}

# NiniMed compatibility: its basePath build serves /health, while older raw links and
# fetch("/api/...") calls still target the origin root. Route unclaimed paths to that app.
# Exact "/" remains the portal; the other app prefixes are excluded and handled above.
location ~ ^/(?!health(?:/|$)|school(?:/|$)|feud(?:/|$)|paraphrase(?:/|$)|wa(?:/|$))(.*)$ {
    rewrite ^/(.*)$ /health/$1 last;
}
```

`proxy_pass` has no path after the host, so each request keeps its prefix. Each upstream app must
be configured to handle that prefix. `passenger_enabled off;` stops the root site's Node.js app from
intercepting proxied paths. NiniMed is not proxied: the final rewrite sends its unclaimed legacy
paths to the existing Passenger app under `/health`. Click **OK**; Plesk checks the configuration
before applying it.

Check the forwarding for each app before switching its public links. Forma's
`https://www.wisdomcourse.com.et/school/api/health` must return Forma's JSON health report. The
root URL should show the portal; `/apps` should redirect to it.

The backend hostnames in these rules are still used by nginx to reach the apps; users should only
need the single `www` domain.

## 3. Rebuild Forma for `/school`

In GitHub → the repository → **Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
|---|---|
| `PUBLIC_URL` | `https://www.wisdomcourse.com.et` |
| `BASE_PATH` | `/school` |

Then in Forma's Plesk settings (`school.wisdomcourse.com.et` → **Node.js** → environment
variables, or the `.env` file beside `app.js`):

| Setting | Value |
|---|---|
| `BETTER_AUTH_URL` | `https://www.wisdomcourse.com.et` (origin only, no `/school`) |

Re-run the latest **CI / CD** workflow (Actions → CI / CD → Run workflow) so a release is built for
`/school`. When Plesk has pulled it, click **Restart App** once (later releases restart on their
own). Check `https://www.wisdomcourse.com.et/school/api/health`: `release.basePath` must be
`/school`.

Everyone is signed out once, because Forma's cookie name changed.

## 4. Configure the other app paths and databases

This repository contains Forma and the static portal. NiniMed is built for `/health`; Family Feud,
VERITAS AI, and Ethiopian Wisdom still need their path routing configured in their own
deployments. The checked-out app sources use these database engines and table-prefix settings:

| App | Path prefix | Current database engine | Current table prefix | Existing backend |
|---|---|---|---|---|
| Forma | `/school` | MySQL | `school_` | `school.wisdomcourse.com.et` |
| NiniMed | `/health` | PostgreSQL | None; tables are currently unprefixed | Existing `www` Passenger app, mounted at `/health` by Next.js middleware |
| Family Feud | `/feud` | MySQL | `feud_` by default (`DB_TABLE_PREFIX`) | `feud.wisdomcourse.com.et` |
| VERITAS AI | `/paraphrase` | MySQL for account data; SQLite for local auth/jobs | `paraphrase_` by default for MySQL; SQLite data stays local | `paraphrase.wisdomcourse.com.et` |
| Ethiopian Wisdom | `/wa` | MySQL | Configurable with `DB_TABLE_PREFIX` (normally `wa_`) | `app.wisdomcourse.com.et` |

Keep NiniMed's PostgreSQL database separate as requested. Forma, Family Feud, VERITAS AI's MySQL
account store, and Ethiopian Wisdom can use one MySQL schema with distinct table prefixes. Do not
point NiniMed at a MySQL URL or the MySQL apps at a PostgreSQL URL.

For a MySQL-only shared schema, retain distinct prefixes for Forma, Feud, VERITAS AI, and Ethiopian
Wisdom. Prefixes avoid table-name collisions but do not isolate data or permissions. VERITAS AI
currently keeps authentication/job data in local SQLite as well, so a shared MySQL schema would not
automatically consolidate those stores. Inventory all data stores, take verified backups, and test
conversions against disposable copies before changing production.

Before applying this to an existing production database, inventory the current tables and take a
verified backup. Renaming tables or changing migration histories can break live apps; plan and test
any data move explicitly. Do not migrate the other apps to the existing Forma schema until their
source code and migrations have been updated and tested against a disposable copy of the combined
schema.

Set each application's public URL/base-path settings to the canonical origin and its path prefix.
NiniMed's Next.js middleware serves the app under `/health`; set `NEXT_PUBLIC_APP_URL` to
`https://www.wisdomcourse.com.et/health`.
For a Next.js app, set `basePath` at build time; for Vite, configure both the asset base and router
base; for Express, mount the router and static files under the prefix. Update auth callbacks, email
links, API URLs, and cookie names too. Each app must be tested directly through its prefix before
the public links are switched.

## 5. Redirect old app URLs (optional)

After each path is working through `www`, configure its old public subdomain to redirect visitors
to the new path while allowing requests proxied from `www` through. For Forma, Plesk →
`school.wisdomcourse.com.et` → **Apache & nginx Settings** → **Additional nginx directives**:

```nginx
if ($http_x_wisdom_portal != "1") {
    rewrite ^/school(/.*)?$ https://www.wisdomcourse.com.et/school$1 permanent;
    rewrite ^/(.*)$ https://www.wisdomcourse.com.et/school/$1 permanent;
}
```

For the other apps, use their path and host from the table above. Query strings are preserved for
existing invitation and password-reset links. The backend subdomains may remain for proxy traffic;
the goal is one public URL domain, not necessarily one backend process.

## 6. Check

- `https://www.wisdomcourse.com.et/` shows the portal and five dedicated app buttons.
- Each button opens its matching path: `/school`, `/health`, `/feud`, `/paraphrase`, or `/wa`.
- NiniMed loads at `/health/`; `/health/api/health` returns its service health response, and
  App Router navigation returns an RSC payload under the same prefix.
- The Forma health endpoint at `https://www.wisdomcourse.com.et/school/api/health` reports the
  `/school` release and a healthy database.
- Each app signs in, loads its CSS/JavaScript, and serves its API under the right prefix (no RSC,
  asset, or API 404s in the browser console).
- Signing in and out of Forma works; invitations and password-reset emails use the `/school` URL.
- `https://school.wisdomcourse.com.et/login` redirects to
  `https://www.wisdomcourse.com.et/school/login`.

## Going back

Restore the previous root-site configuration and remove the portal and app-path nginx rules.
Revert each app's base-path/public-URL settings, restore its previous public links, and restart the
apps. Do not delete any app database during rollback; each database remains independently managed.
