## What

<!-- One sentence: what does this PR do? -->

## Why

<!-- Why is this change needed? Link to GitHub issue if applicable (e.g. #42, #44). -->

## How

<!-- Brief description of the approach taken. -->

## Checklist

- [ ] Tested locally (`make up`)
- [ ] No regressions on existing flows
- [ ] Migration added and tested up + down (if schema change)
- [ ] `COALESCE(col, '')` used for any nullable TEXT columns in new SELECT/RETURNING queries
- [ ] Postman collection updated (if API routes/shapes changed) — `postman/HomeJira.postman_collection.json`
- [ ] `go build ./...` and `go vet ./...` pass
- [ ] `npm run build` and `npm run lint` pass

## QA Sign-off

<!-- Invoke /qa1 (backend) and/or /qa2 (frontend) before requesting merge.
     QA agent will post "QA-1 ✅" or "QA-2 ✅" as a comment. -->

- [ ] QA-1 sign-off (backend / API changes)
- [ ] QA-2 sign-off (frontend / UI changes)

## Screenshots (if UI change)

<!-- Before / after screenshots or a short screen recording -->
