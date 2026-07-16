# Codex Instructions For IDS-HRM-GIS Portal

## Scope

Work inside `portal/` only unless the user explicitly asks to integrate with the existing public website.

## Architecture

- Keep frontend and backend separated.
- Backend follows modular monolith boundaries under `backend/src/modules`.
- Shared security, validation, HTTP, and config code lives under `backend/src/core`.
- Frontend follows feature folders under `frontend/src/features`.

## Security Rules

- Use server-side sessions.
- Do not store sensitive tokens in `localStorage`.
- Do not hard-code secrets.
- Treat authentication, authorization, validation, CSRF, secure cookies, rate limiting, device policy, audit logging, and exception handling as shared cross-cutting concerns.
- Mobile/device blocking must be enforced by backend or reverse proxy/device policy, not only frontend.

## Change Rules

- Add business behavior inside the owning module.
- Do not import another module repository directly.
- Cross-module access must go through service or route-level contracts.
- Split files when a file owns more than one responsibility or approaches 250 lines.
- Avoid tiny files that only wrap one local function unless they express a security or module boundary.

## Verification

- Run `npm test` from `portal/` after code changes.
- Report moved, created, and modified files.
- Do not commit or push unless explicitly requested.
