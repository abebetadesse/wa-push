# Serving every app from wisdomcourse.com.et

All apps move under one domain, each on its own path, with a portal page at the root:

| Today | After |
|---|---|
| `https://wisdomcourse.com.et` | `https://wisdomcourse.com.et/` — portal with category tabs (`portal/index.html`) |
| `https://app.wisdomcourse.com.et` | `https://wisdomcourse.com.et/app/` |
| `https://school.wisdomcourse.com.et` | `https://wisdomcourse.com.et/school` (Forma) |
| `https://feud.wisdomcourse.com.et` | `https://wisdomcourse.com.et/feud/` |
| `https://paraphrase.wisdomcourse.com.et` | `https://wisdomcourse.com.et/paraphrase/` |

## How it works

Each app keeps running exactly where it runs now: its own subdomain, its own Node.js app in Plesk,
its own code and releases. Nothing is merged, so a failure in one app cannot take down another.

1. **The main domain forwards each path to that app's subdomain.** nginx on
   `wisdomcourse.com.et` sends `/school…` to `school.wisdomcourse.com.et`, `/feud…` to
   `feud.wisdomcourse.com.et`, and so on, and marks those requests with an `X-Wisdom-Portal`
   header.
2. **Each app is built for its path**, so every link and asset it produces starts with that path
   (`/school/_next/…`, `/school/login`).
3. **Each subdomain redirects visitors to the new address.** Requests without the
   `X-Wisdom-Portal` header come from people using old links, and are sent to
   `https://wisdomcourse.com.et/<path>/…`, so bookmarks keep working.
4. **The portal page** at the root lists the apps with category tabs and search.

Visitors only ever see `wisdomcourse.com.et`; the subdomains become private back ends.

> **Do the steps in order.** If an app is rebuilt for its path before the main domain forwards
> that path, its subdomain shows a broken page. Switch one app at a time and check it before
> moving to the next.

## Before you start

- **The database must accept writes.** The shared server `mysql-db02.remote` is currently
  read-only (`SELECT @@global.read_only` returns 1). Moving to one domain does not change that; see
  the database section of `DEPLOYMENT.md`.
- **Know what serves the root today.** If `wisdomcourse.com.et` is an app rather than plain files,
  give it its own path first (for example `/app/` or `/home/`), the same way as the others,
  because the root becomes the portal.
- **Cookies are shared by every app on one domain.** Each app needs its own cookie names, or one
  app's sign-in replaces another's. Forma uses the prefix `forma` (`advanced.cookiePrefix` in
  `src/lib/auth.ts`). Any other app using better-auth needs its own prefix too; apps using other
  sign-in libraries need their session cookie renamed similarly.

## 1. Add the portal page

1. Plesk → **Websites & Domains** → `wisdomcourse.com.et` → **File Manager**.
2. Open the document root (usually `httpdocs`). Back up the current `index.html` / `index.php`
   if there is one.
3. Upload `portal/index.html` from this repository as `index.html`.
4. Edit the `apps` list at the bottom of the file to adjust names, descriptions, icons and
   categories. Each entry's `path` must match the path used below.

## 2. Forward the paths from the main domain

Plesk → `wisdomcourse.com.et` → **Apache & nginx Settings** → **Additional nginx directives**.
Add one block per app (the Forma block is shown; copy it for `feud`, `paraphrase` and `app`,
changing the path and the subdomain):

```nginx
# Forma — school management
location ~ ^/school(/|$) {
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
```

`proxy_pass` has no path after the host, so the request keeps its `/school/…` path, which is
what the rebuilt app expects. Click **OK**; Plesk checks the configuration before applying it.

## 3. Rebuild Forma for `/school`

In GitHub → the repository → **Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
|---|---|
| `PUBLIC_URL` | `https://wisdomcourse.com.et` |
| `BASE_PATH` | `/school` |

Then in the Forma app's Plesk settings (school subdomain → **Node.js** → environment variables,
or the `.env` file beside `app.js`):

| Setting | Value |
|---|---|
| `BETTER_AUTH_URL` | `https://wisdomcourse.com.et` (origin only, no `/school`) |

Re-run the latest **CI / CD** workflow (Actions → CI / CD → Run workflow) so a release is built for
`/school`. When Plesk has pulled it, click **Restart App** once (later releases restart on their
own). Check `https://wisdomcourse.com.et/school/api/health`: `release.basePath` must be `/school`.

Everyone is signed out once, because the new cookie name differs from the old one.

## 4. Redirect the old subdomain

Plesk → `school.wisdomcourse.com.et` → **Apache & nginx Settings** → **Additional nginx
directives**:

```nginx
# Old links: send visitors to wisdomcourse.com.et/school. Requests forwarded by the main domain
# carry X-Wisdom-Portal and are served normally.
if ($http_x_wisdom_portal != "1") {
    rewrite ^/school(/.*)?$ https://wisdomcourse.com.et/school$1 permanent;
    rewrite ^/(.*)$ https://wisdomcourse.com.et/school/$1 permanent;
}
```

Query strings are kept, so password-reset and invitation links sent before the move still work.
Remove any older `location ^~ /school` rule from `app.wisdomcourse.com.et`; it is no longer used.

## 5. Check

- `https://wisdomcourse.com.et/` shows the portal; the **School management** card opens
  `https://wisdomcourse.com.et/school`.
- Signing in and out works, and pages load with their styles (no `/_next/...` 404s in the
  browser console).
- `https://school.wisdomcourse.com.et/login` redirects to `https://wisdomcourse.com.et/school/login`.
- Invitations and password-reset emails link to `https://wisdomcourse.com.et/school/...`.

## The other apps

Repeat steps 2–5 for `feud`, `paraphrase` and `app`. Each app must be able to run under its
path; how depends on how it is built:

| App type | Setting |
|---|---|
| Next.js | `basePath: "/feud"` in `next.config` |
| Vite / React / Vue | `base: "/feud/"` in the Vite config, and the router's base path |
| Express / Node | mount the routes under `/feud` (`app.use("/feud", router)`), static files too |
| PHP / Laravel | `APP_URL=https://wisdomcourse.com.et/feud`, and links built from it |

Also point each app's own public-URL setting (sign-in callbacks, emailed links, CORS/allowed
origins) at `https://wisdomcourse.com.et/<path>`.

## Going back

Remove the main-domain `location` block and the subdomain redirect, set the GitHub variables
back (`BASE_PATH` empty, `PUBLIC_URL` `https://school.wisdomcourse.com.et`), set
`BETTER_AUTH_URL` back, re-run the workflow, and restart the app.
