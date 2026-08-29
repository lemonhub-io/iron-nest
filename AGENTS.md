<!-- Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later -->

# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + TypeScript browser game. Application entry and DOM wiring live in `src/main.ts`; shared visual styling is in `src/style.css`. Keep gameplay rules in `src/game/` (`engine.ts`, ballistics, geometry, missions, and audio), map rendering in `src/ui/map.ts`, and locale catalogs in `src/i18n/en.ts` and `src/i18n/zh.ts`. Static images belong in `public/assets/`; bundled font assets and their license live in `src/assets/fonts/`. The end-to-end gameplay harness is `scripts/playtest.ts`.

## Build, Test, and Development Commands

- `npm ci` installs the lockfile-pinned dependencies.
- `npm run dev` starts Vite on port 5173 for local development.
- `npm run check:copyright` verifies required `lemonhub-io` copyright and AGPL SPDX declarations.
- `npm run build` runs strict TypeScript checking and creates the production bundle in `dist/`.
- `npm run preview` serves the built bundle for a final browser check.

Run `npm run build` before handing off changes. `scripts/playtest.ts` exercises the complete mission flow; run it with a TypeScript/Vite runner when changing game state, firing flow, or missions.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, double-quoted strings, and ESM imports. Keep `strict`, `noUnusedLocals`, and `noUnusedParameters` clean; do not suppress errors merely to compile. Use `camelCase` for functions and values, `PascalCase` for types, and concise kebab-case asset names such as `noto-serif-sc-700.woff2`. Keep UI text in locale catalogs rather than hard-coding it in game code. Preserve the existing paper-and-field-manual visual system and test both `en` and `zh` after UI changes.

## Testing Guidelines

There is no unit-test framework or coverage target. Add focused assertions to `scripts/playtest.ts` for regressions in game progression. Test the failing path first, then the successful path; for example, a missed shot must return to duty and permit reload, re-arm, and a corrected second shot.

## Commit & Pull Request Guidelines

Follow the established concise, imperative commit style: `Improve map plotting...` or `Add ... MVP`. Keep each commit scoped. Pull requests should explain player-visible behavior, list validation commands, link related issues, and include screenshots or a short recording for visual, map, or localization changes.
