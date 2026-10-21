# Serving every app from www.wisdomcourse.com.et

NiniMed stays the homepage. The other apps move under the same domain, each on its own path, and a
portal page at `/apps` lists them all:

| Today | After |
|---|---|
| `https://www.wisdomcourse.com.et` (NiniMed) | unchanged — the homepage |
| — | `https://www.wisdomcourse.com.et/apps` — portal with category tabs (`portal/index.html`) |
| `https://school.wisdomcourse.com.et` (Forma) | `https://www.wisdomcourse.com.et/school` |
| `https://app.wisdomcourse.com.et` (Ethiopian Wisdom) | `https://www.wisdomcourse.com.et/app` |
| `https://feud.wisdomcourse.com.et` (Family Feud) | `https://www.wisdomcourse.com.et/feud` |
| `https://paraphrase.wisdomcourse.com.et` (VERITAS AI) | `https://www.wisdomcourse.com.et/paraphrase` |

`https://wisdomcourse.com.et` already redirects to `www` and keeps the path, so
`wisdomcourse.com.et/school` works too. On 21 October none of these paths was used by NiniMed.

## How it works

Each app keeps running exactly where it runs now: its own subdomain, its own Node.js app in Plesk,
its own code and releases. Nothing is merged, so a failure in one app cannot take down another.

1. **The `www` domain forwards each path to that app's subdomain.** nginx sends `/school…` to
   `school.wisdomcourse.com.et`, `/feud…` to `feud.wisdomcourse.com.et`, and so on, and marks
   those requests with an `X-Wisdom-Portal` header. Everything else still goes to NiniMed.
2. **Each app is built for its path**, so every link and file it produces starts with that path
   (`/school/_next/…`, `/school/login`). This matters doubly here: NiniMed is a Next.js app that
   uses `/_next/…` at the root, so an app that still loaded `/_next/…` would get NiniMed's files.
3. **Each subdomain redirects visitors to the new address.** Requests without the
   `X-Wisdom-Portal` header come from old links and bookmarks, and are sent to
   `https://www.wisdomcourse.com.et/<path>/…`.
4. **nginx serves the portal page** at `/apps` straight from a file, without involving NiniMed.

> **Do the steps in order, one app at a time.** If an app is rebuilt for its path before `www`
> forwards that path, its subdomain shows a broken page.

## Before you start

- **The database must accept writes.** The shared server `mysql-db02.remote` is currently
  read-only (`SELECT @@global.read_only` returns 1), so nobody can sign in to Forma at any
  address until the host fixes it.
- **Cookies are shared by every app on one domain** — NiniMed's included. Each app needs its own
  cookie names, or one app's sign-in replaces another's. Forma uses the prefix `forma`
  (`advanced.cookiePrefix` in `src/lib/auth.ts`). Another app using better-auth needs its own
  prefix; apps using other sign-in libraries need their session cookie renamed similarly.
- **Find the domain's folder on the server.** Plesk → **Websites & Domains** → `wisdomcourse.com.et`
  → **Hosting & DNS → Hosting**: the document root is shown there, usually
  `/var/www/vhosts/wisdomcourse.com.et/httpdocs`. Below, `/var/www/vhosts/wisdomcourse.com.et`
  stands for the part before `/httpdocs`; replace it if yours differs.

## 1. Add the portal page

1. Plesk → `wisdomcourse.com.et` → **File Manager**. At the top level (next to `httpdocs`, not
   inside it, so it stays separate from NiniMed), create a folder `portal`.
2. Upload `portal/index.html` from this repository into it.
3. The `apps` list at the bottom of the file holds each card's name, path, category, icon and
   description; edit it as needed.

The page is served by the nginx block in step 2.

## 2. Forward the paths on www.wisdomcourse.com.et

Plesk → `wisdomcourse.com.et` (the domain that serves `www`) → **Apache & nginx Settings** →
**Additional nginx directives**. Add:

```nginx
# Portal page listing every app
location = /apps {
    default_type text/html;
    alias /var/www/vhosts/wisdomcourse.com.et/portal/index.html;
}
location = /apps/ { return 301 /apps; }

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
`https://www.wisdomcourse.com.et/apps` now shows the portal.

For each other app, add a copy of the Forma block **when that app is ready for its path** (see
"The other apps"), changing `school` to `feud`, `paraphrase` or `app` in the three places it appears.

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

## 4. Redirect the old subdomain

Plesk → `school.wisdomcourse.com.et` → **Apache & nginx Settings** → **Additional nginx
directives**:

```nginx
# Old links: send visitors to www.wisdomcourse.com.et/school. Requests forwarded by www carry
# X-Wisdom-Portal and are served normally.
if ($http_x_wisdom_portal != "1") {
    rewrite ^/school(/.*)?$ https://www.wisdomcourse.com.et/school$1 permanent;
    rewrite ^/(.*)$ https://www.wisdomcourse.com.et/school/$1 permanent;
}
```

Query strings are kept, so password-reset and invitation links sent before the move still work.
Remove any older `location ^~ /school` rule from `app.wisdomcourse.com.et`; it is no longer used.

## 5. Check

- `https://www.wisdomcourse.com.et/` is still NiniMed.
- `https://www.wisdomcourse.com.et/apps` shows the portal; **Forma — School management** opens
  `https://www.wisdomcourse.com.et/school`.
- Signing in and out of Forma works, and pages load with their styles (no `/_next/...` 404s in
  the browser console).
- `https://school.wisdomcourse.com.et/login` redirects to
  `https://www.wisdomcourse.com.et/school/login`.
- Invitations and password-reset emails link to `https://www.wisdomcourse.com.et/school/...`.

## The other apps

For Ethiopian Wisdom (`/app`), Family Feud (`/feud`) and VERITAS AI (`/paraphrase`):

1. Make the app run under its path:

   | App type | Setting |
   |---|---|
   | Next.js | `basePath: "/feud"` in `next.config` |
   | Vite / React / Vue | `base: "/feud/"` in the Vite config, and the router's base path |
   | Express / Node | mount the routes under `/feud` (`app.use("/feud", router)`), static files too |
   | PHP / Laravel | `APP_URL=https://www.wisdomcourse.com.et/feud`, and links built from it |

   Also point its own public-URL settings (sign-in callbacks, emailed links, allowed origins) at
   `https://www.wisdomcourse.com.et/<path>`, and give its sign-in cookie a unique name.
2. Add its forwarding block on `www` (step 2), deploy it, and add its subdomain redirect (step 4,
   with `school` replaced by its path).
3. Check it as in step 5.

Family Feud returned 503 on 21 October; get it running on its subdomain before moving it.

## Going back

Remove the `www` `location` blocks and the subdomain redirect, set the GitHub variables back
(`BASE_PATH` empty, `PUBLIC_URL` `https://school.wisdomcourse.com.et`), set `BETTER_AUTH_URL`
back, re-run the workflow, and restart the app.
