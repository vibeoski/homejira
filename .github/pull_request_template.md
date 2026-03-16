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

## Screenshots (if UI change)

<!-- Before / after screenshots or a short screen recording -->
