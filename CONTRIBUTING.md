<!-- Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later -->

# Contributing to IRON NEST

Thanks for helping improve the field manual. By submitting a contribution, you
agree that it may be distributed under the project’s
[AGPL-3.0-or-later license](LICENSE).

## Getting Started

1. Fork the repository and create a focused branch, for example
   `fix/reload-after-miss` or `feat/mission-briefing`.
2. Install dependencies with `npm ci`.
3. Use `npm run dev` to test the interface locally.
4. Run `npm run build` before submitting changes. It includes strict TypeScript
   checking, copyright/SPDX validation, and the Vite production build.

## Change Guidelines

- Keep game rules in `src/game/`, map behavior in `src/ui/map.ts`, and display
  copy in `src/i18n/`.
- Update both `en.ts` and `zh.ts` whenever you add or change visible text.
- Preserve keyboard access, focus styles, responsive behavior, and the existing
  paper field-manual aesthetic.
- Add or extend assertions in `scripts/playtest.ts` for mission or state-machine
  regressions. Test a failure path as well as the successful path.
- Include licenses and source notes for every added third-party asset or font.
- License project-owned visual assets in `public/assets/` under CC BY-SA 4.0,
  add them to [ASSET-LICENSES.md](ASSET-LICENSES.md), and preserve any separate
  third-party license notices.
- Add the required `lemonhub-io` AGPL SPDX header to every commentable source,
  configuration, or documentation file over 10 lines. Use
  `npm run check:copyright` to verify it.

## Pull Requests

Use a short, imperative commit subject, such as `Fix reload after a missed
shot`. In the pull request description, explain the player-visible change,
list the validation performed, and link the relevant issue. Include screenshots
or a short recording for visual, map, animation, or translation updates. Keep
unrelated refactors out of the same pull request.
