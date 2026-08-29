<!-- Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later -->

# IRON NEST Field Manual

IRON NEST is a browser-based, bilingual field-manual game about plotting a
firing solution, loading a turret, and confronting the consequences of each
order. It is a fictional anti-war work presented through maps, teleprinter
dispatches, firing cards, and newspaper reports.

**Author:** lemonhub-io  
**License:** [AGPL-3.0-or-later](LICENSE)

## Features

- Three linked missions with multiple endings.
- Map plotting, observer triangulation, ballistics, loading, aiming, and firing
  flows.
- English and Simplified Chinese interfaces, including locally bundled Chinese
  sans-serif and serif fonts.
- No account, backend service, or build-time API key required.

## Run Locally

**Prerequisites:** Node.js 20+ and npm.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Use the
language switcher at any time. For a production build and TypeScript check:

```bash
npm run build
npm run preview
```

`npm run build` automatically verifies source copyright and AGPL declarations.
Run `npm run check:copyright` on its own when updating files or package metadata.

## How to Play

1. Read the command or front-line dispatch and plot the requested information.
2. Use a red line from the Iron Nest to produce bearing and range; intersect
   yellow observer rays when a target is hidden.
3. Copy the range, choose a powder charge, calculate elevation, load, lay, arm,
   and fire.
4. After a miss, reload and correct the solution. The final operation permits
   more than one ending.

## Project Layout

| Path | Purpose |
| --- | --- |
| `src/game/` | Game state, missions, geography, ballistics, and audio. |
| `src/ui/map.ts` | Canvas map interaction and rendering. |
| `src/i18n/` | English and Simplified Chinese catalogs. |
| `src/assets/fonts/` | Vendored Chinese font files and license notices. |
| `public/assets/` | Static imagery. |
| `scripts/playtest.ts` | End-to-end mission-flow regression harness. |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), keep both
locales in sync, and run `npm run build` before opening a pull request. Please
do not commit `dist/` or `node_modules/`.

## License, Art, and Font Notices

The project source is licensed under the GNU Affero General Public License,
version 3 or later. A network-deployed modified version must make its complete
corresponding source available to users. See [LICENSE](LICENSE). Project-owned
art assets in `public/assets/` are licensed under CC BY-SA 4.0; see
[ASSET-LICENSES.md](ASSET-LICENSES.md) for the complete asset list and required
attribution. Bundled Noto Serif SC font files are separately available under the
SIL Open Font License 1.1; see [`src/assets/fonts/OFL.txt`](src/assets/fonts/OFL.txt).
