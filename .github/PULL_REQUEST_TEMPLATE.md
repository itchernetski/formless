## What this changes

<!-- The user-visible effect, in a sentence or two. Link the issue it closes. -->

Closes #

## How I verified it

<!-- Tests added? Tried it on a real site? "Tested on https://… — 11/12 fields filled" is a great line. -->

## Checklist

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass
- [ ] Tests added or updated for anything with logic (required for `detection/` and `vault/` changes)
- [ ] No new network requests from the extension
- [ ] Sensitive-field handling unchanged, or changed with tests
- [ ] Imports and captures still go through the review diff
- [ ] Docs / help page updated if behaviour changed
- [ ] No unrelated reformatting

## Notes for review

<!-- Trade-offs, things you're unsure about, follow-ups you deliberately left out. -->
