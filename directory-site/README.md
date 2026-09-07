# Nostr Atlas directory site

Nostr Atlas is a self-contained Vite + TypeScript concept for creator account
claims. It is designed to connect the X and YouTube accounts an audience already
knows to a creator's Nostr identity, making that identity easier to find and zap
from compatible Nostr clients. It intentionally lives beside the existing
component library so the package build and backend jobs remain unchanged.

## Run locally

From the repository root:

```sh
npm run dev:directory
```

Then open the URL printed by Vite.

## Build

```sh
npm run build:directory
```

The deployable static site is written to `directory-site/dist/`.

The current profile list is local demo data. Search, categories, sorting, copy
feedback, responsive navigation, and the in-browser claim preview are functional.
The preview does not publish a claim, verify account ownership, or route payments.
The Firestore-backed relay-directory projection can replace `src/data.ts` when a
public claim API is available.
