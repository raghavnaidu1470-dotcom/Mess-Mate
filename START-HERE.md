# MessMate — start here

This is the complete tracked source snapshot of the MessMate VIT portal, exported September 21, 2026.
Source commit: 18abd49533e8b8c005688b257b1f6ffdfaad7010

## Put it on your computer
1. Download MessMate-Source.zip and double-click it to extract the MessMate folder.
2. Move the folder wherever you keep projects (for example Documents/Projects).
3. Open that entire folder in VS Code or another editor. FILE-INDEX.md lists every included file.

## Preview locally
Install Node.js 24 LTS and pnpm 11.25.0 first. Open a terminal inside the extracted MessMate folder, then run:

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_worthless_misty_knight.sql
pnpm dev
```

Apply that migration only once to a new local database. Open the localhost URL printed by the development server (normally http://localhost:5173). Stop with Ctrl+C. On later starts, use `pnpm dev` without reinstalling or replaying migrations. `pnpm start` previews the built Worker instead.

This clean export defaults to the portable runtime; you do not need the ChatGPT Sites plugin to select that profile. Dependency installation requires internet access. These commands follow the checked-in project configuration; this export has not been tested on your own computer.

## Activate the portal
Read PORTAL-SETUP.md before using real accounts. The source is a dynamic application using Cloudflare D1 and private R2, not a static HTML site. Local emulation starts empty and does not download the hosted database or photo storage.

Email verification requires a configured email provider and sender. Warden bootstrap credentials, approved institution email/registration patterns, actual caterer roster, and an external scheduler must also be configured. `.env.example` lists the required setting names; supply values through your runtime's environment configuration. No live credentials or preconfigured login accounts are included. The starter's optional ChatGPT login helper does not authenticate a MessMate student or warden.

The real MessIT importer is included; imported production menus and user records are not part of this source export. Nutrition coverage and live email/camera/scheduler acceptance testing remain incomplete. The festival calendar currently covers 2026.

## Main folders
| Folder/file | Contents |
| --- | --- |
| app/ | Pages, meal routes, API route, shared layout and styles |
| components/vit-portal.tsx | MessMate student, incharge and warden interface |
| components/ui/ | Reusable UI components |
| lib/ | Authentication, permissions, menu import, email, festival and nutrition logic |
| db/ and drizzle/ | Database schema and migrations |
| public/ | Public assets |
| scripts/ | Development/build helpers, tests, warden password hash helper |
| PORTAL-SETUP.md | Portal activation details and known limits |
| README.md | Original framework starter notes; use this guide and package.json for current pnpm commands |

## What this ZIP includes
All tracked source files, package lockfile, database migrations, assets, configuration, and setup documents. Also included: this guide and a complete file index with SHA-256 hashes.

Excluded: real environment files, credentials, Git history, installed dependencies, generated builds/caches, and hosted database/photo contents. The build/ folder contains source tooling and is intentionally included.

This ZIP is a snapshot. Later edits made in ChatGPT will not automatically update your downloaded folder. A shared Git repository and pulling new commits would be needed for ongoing synchronization. Extracting or running this copy does not change the live website.
