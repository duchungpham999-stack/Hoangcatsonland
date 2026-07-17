# IDS-HRM-GIS Portal Source Structure

## Folder Tree

```text
portal/
  package.json
  AGENTS.md
  backend/
    .env.example
    src/
      app.js
      server.js
      config/
        env.js
        app.config.js
        database.config.js
        session.config.js
        security.config.js
      core/
        http/
        security/
        validation/
      modules/
        auth/
          password/
          csrf/
          mfa/
          webauthn/
          session/
          login-attempts/
          device-access/
          account-recovery/
          admin-create-cli.js
        users/
        roles/
        permissions/
        devices/
        sessions/
        audit/
        ids/
        hrm/
        gis/
    tests/
  frontend/
    index.html
    src/
      app.js
      main.js
      features/
        auth/
        portal-dashboard/
        ids/
        hrm/
        gis/
        shared/
      shared/
    tests/
  docs/
```

## File Responsibilities

- `backend/src/app.js`: assembles middleware and module routes.
- `backend/src/server.js`: starts the HTTP process only.
- `backend/src/config/env.js`: the only environment configuration entrypoint and the only file allowed to read `process.env`.
- `backend/src/config/*.config.js`: validated app, database, session, and security config builders without direct `process.env` access.
- `backend/src/core/http`: routing, request parsing, response helpers.
- `backend/src/core/security`: authentication middleware, authorization guard, validation-adjacent security controls, CSRF, rate limiting, secure cookies, audit logging, exception handling, device policy.
- `backend/src/core/validation`: shared schema validation helpers.
- `backend/src/modules/*/routes.js`: HTTP endpoint registration for one module.
- `backend/src/modules/*/controller.js`: request/response orchestration only.
- `backend/src/modules/*/service.js`: business rules owned by the module.
- `backend/src/modules/*/repository.js`: persistence boundary owned by the module.
- `backend/src/modules/*/schema.js`: input contract for the module.
- `backend/src/modules/*/types.js`: public type vocabulary for the module.
- `backend/src/modules/auth/password`: password hashing and verification; never stores plaintext passwords.
- `backend/src/modules/auth/csrf`: signed double-submit CSRF token issuance and validation.
- `backend/src/modules/auth/session`: session token generation, token hashing, cookie handling, and session revocation.
- `backend/src/modules/auth/admin-create-cli.js`: local operational CLI for creating the first admin without hard-coded credentials.
- `frontend/src/features/*`: page or feature UI owned by one portal feature.
- `frontend/src/shared`: frontend utilities that are not business-specific.

## When To Split Files

- Split a file when it mixes transport, business logic, persistence, or security policy.
- Split a module service when a subdomain becomes independently testable.
- Keep a controller thin; move decisions to service.
- Keep repositories free of HTTP/session concerns.
- Do not split one small function into its own file unless it is a stable boundary such as MFA, passkey, or device policy.

## Naming Convention

- New files and folders use lowercase ASCII kebab-case.
- Module folders use domain names: `auth`, `users`, `ids`, `hrm`, `gis`.
- HTTP files use `routes.js` and `controller.js`.
- Business files use `service.js`.
- Persistence files use `repository.js`.
- Validation files use `schema.js`.
- Test files use `*.test.js`.

## Dependency Rules

- `backend/src/core` cannot import from business modules except explicit session lookup wiring in authentication middleware.
- Module controllers may import their own service and shared core helpers.
- Module services may import their own repository and shared core helpers.
- Module repositories must not import controllers or services.
- One module must not import another module repository.
- Cross-module workflows should be introduced through a service-level contract or application service, not direct database access.
- Frontend features may import `frontend/src/shared` and their own local files.
- Frontend shared code must not import feature code.

## Security Baseline

- Sessions are server-side and represented to the browser by secure, HTTP-only cookies.
- Sensitive tokens are not stored in `localStorage`.
- CSRF protection is central middleware for unsafe methods.
- Rate limiting is central middleware and should later be backed by Redis or a shared store.
- Device blocking is represented in backend policy and should be mirrored at reverse proxy/WAF.
- Audit logging is central and should be persisted before production.
- Secrets are read from environment variables or a secret manager, never committed.
