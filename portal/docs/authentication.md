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

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Login returns a safe user object and sets an HTTP-only cookie. It never returns the session token in JSON.

## PowerShell Smoke Test

```powershell
$base='http://127.0.0.1:4173'
$body=@{ email='admin@example.test'; password='change-this-local-password' } | ConvertTo-Json
$login=Invoke-WebRequest "$base/api/auth/login" -Method POST -ContentType 'application/json' -Headers @{ 'x-csrf-token'='test' } -Body $body -SessionVariable session
Invoke-RestMethod "$base/api/auth/me" -WebSession $session
Invoke-RestMethod "$base/api/auth/logout" -Method POST -Headers @{ 'x-csrf-token'='test' } -WebSession $session
```

## curl Smoke Test

```bash
curl -i -c cookies.txt \
  -H 'content-type: application/json' \
  -H 'x-csrf-token: test' \
  -d '{"email":"admin@example.test","password":"change-this-local-password"}' \
  http://127.0.0.1:4173/api/auth/login

curl -b cookies.txt http://127.0.0.1:4173/api/auth/me

curl -b cookies.txt -H 'x-csrf-token: test' -X POST http://127.0.0.1:4173/api/auth/logout
```
