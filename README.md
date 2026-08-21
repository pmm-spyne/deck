# Client deck (isolated)

Standalone customer pitch deck. **Does not modify the main demo app.**

## View / share

Open the standalone file (best for sharing a folder):

```bash
open docs/client-deck/client-deck.html
```

Or while `npm run dev` is running, open the hosted copy (same files via `public/client-deck` → `docs/client-deck`):

[http://127.0.0.1:5174/client-deck/client-deck.html](http://127.0.0.1:5174/client-deck/client-deck.html)

This is **not** the React app (`/v2-export/...`). Studio OS and other client customizations only exist in this HTML deck.

## Rebuild (optional)

With `npm run dev` on port 5174:

```bash
node docs/client-deck/export-client-deck-html.mjs
node docs/client-deck/wire-client-deck-interactions.mjs
node docs/client-deck/inject-studio-os-slides.mjs
```

`export-client-deck-html.mjs` already injects Studio OS after Pricing; re-run `inject-studio-os-slides.mjs` only if you edited studio copy/CSS without a full export.

Customizations (slide removals, DMS types-only, IMS=API, single recording link, sample-chat title renames, Studio OS block, etc.) live in these scripts / the HTML only — not in `src/`.

## Studio OS notes

- Copy uses **car tours** (not “360 spin”).
- Smart Shoot GIF is loaded from Spyne S3 (large file — keep networked when presenting).
- Local MP4s are under `docs/client-deck/assets/` (relative to the HTML).