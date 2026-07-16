# Project instructions

## Primary objective

Maintain the existing website appearance and behavior while improving project organization.

## Non-negotiable rules

- Do not redesign the UI.
- Do not change visible content unless explicitly requested.
- Do not rename HTML classes or IDs.
- Do not modify CSS values solely for cleanup.
- Preserve CSS loading order.
- Preserve JavaScript execution order.
- Do not remove files unless their references have been verified.
- Use lowercase, ASCII, kebab-case names for new files.
- Update all references after moving a file.
- Make changes in small, reviewable stages.
- Do not restructure all pages in one task.

## Verification

After every change:

- Search the repository for stale paths.
- Check HTML href and src attributes.
- Check CSS url() references.
- Check JavaScript imports and fetch paths.
- Report every modified and moved file.
- Do not claim success unless checks have completed.

## Git

- Work only on the current refactor branch.
- Do not force-push.
- Do not delete Git history.
- Do not merge into main automatically.