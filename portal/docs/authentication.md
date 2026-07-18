# Authentication Foundation

## Local Setup

1. Start PostgreSQL and the backend dependencies:

```bash
docker compose up -d
```

2. Run migrations:

```bash
npm run db:migrate
```

3. Create an admin user without hard-coding credentials:

```bash
ADMIN_EMAIL=admin@example.test ADMIN_USERNAME=admin ADMIN_PASSWORD='change-this-local-password' npm run admin:create
```

On PowerShell:

```powershell
$env:ADMIN_EMAIL='admin@example.test'
$env:ADMIN_USERNAME='admin'
$env:ADMIN_PASSWORD='change-this-local-password'
npm run admin:create
Remove-Item Env:\ADMIN_PASSWORD
```

The CLI does not print the password and refuses duplicate users.

## Endpoints

- `GET /api/auth/csrf`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/auth/me`

Login returns a safe user object and sets an HTTP-only cookie. It never returns the session token in JSON.
Unsafe methods must send a valid `x-csrf-token` obtained from `GET /api/auth/csrf`; arbitrary values are rejected.

## Local UI

Open the frontend through a local static server or the existing editor live server:

```text
portal/frontend/index.html
```

If the backend is running on the same origin, the UI supports:

```text
login -> dashboard -> /api/auth/me -> logout
```

The frontend uses `credentials: "include"` and does not read the HTTP-only session cookie. It does not store session tokens in `localStorage` or `sessionStorage`.

Dashboard modules are shown from real permissions returned by `GET /api/auth/me`:

- `ids.access` shows IDS.
- `hrm.access` shows HRM.
- `gis.access` shows GIS.

The `system_admin` role receives the foundation permissions from migration `005_permission-foundation.sql`.
Users with `mustChangePassword: true` are redirected to the change-password screen before dashboard access. The password change endpoint verifies the current password, requires a new password of at least 12 characters, keeps the active session, revokes other sessions, and records `password_changed`.

## PowerShell Smoke Test

```powershell
$base='http://127.0.0.1:4173'
$body=@{ email='admin@example.test'; password='change-this-local-password' } | ConvertTo-Json
$csrf=Invoke-WebRequest "$base/api/auth/csrf" -SessionVariable session
$csrfToken=($csrf.Content | ConvertFrom-Json).csrfToken
$login=Invoke-WebRequest "$base/api/auth/login" -Method POST -ContentType 'application/json' -Headers @{ 'x-csrf-token'=$csrfToken } -Body $body -WebSession $session
Invoke-RestMethod "$base/api/auth/me" -WebSession $session
Invoke-RestMethod "$base/api/auth/logout" -Method POST -Headers @{ 'x-csrf-token'=$csrfToken } -WebSession $session
```

## curl Smoke Test

```bash
CSRF=$(curl -s -c cookies.txt http://127.0.0.1:4173/api/auth/csrf | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).csrfToken")

curl -i -b cookies.txt -c cookies.txt \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"admin@example.test","password":"change-this-local-password"}' \
  http://127.0.0.1:4173/api/auth/login

curl -b cookies.txt http://127.0.0.1:4173/api/auth/me

curl -b cookies.txt -H "x-csrf-token: $CSRF" -X POST http://127.0.0.1:4173/api/auth/logout
```
