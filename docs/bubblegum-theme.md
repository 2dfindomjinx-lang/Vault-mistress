# Bubblegum OS theme

The approved preview presentation is now in the main application. The preview proxy, fixture data, automatic preview login, environment flags, and package configuration were not transferred. Existing authentication, API routes, economy handlers, and page state remain in place.

## Appearance

- `src/app/bubblegum.css`: window chrome, layout overrides, and hero breathing animation.
- `src/app/bubblegum-legacy.css`: compatibility styles for existing Tailwind colors.
- `src/app/bubblegum-palette.css`: paired light/dark tokens. The light values preserve the approved design.
- CSS Modules compose stable global `bb-Component-local` hooks. This avoids depending on Webpack or Turbopack's hashed class names.
- Images, avatar artwork, rarity ornaments, and furnace artwork are not inverted or filtered for dark mode.

## Theme preference

The moon/sun button appears on the login screen, desktop navigation, and mobile header. `vault-color-mode` in localStorage remembers a deliberate choice and synchronizes it across tabs. Without a saved choice the OS preference is used. A small head script applies the initial palette before the page paints. The theme preference is local and needs no backend endpoint.

The hero portrait breathes over 7.2 seconds using only CSS transforms. It pauses when offscreen or when the document is hidden. Reduced-motion preference disables it. Responsive WebP sources avoid downloading the full portrait for small display sizes. No canvas, video, or JavaScript animation loop is used.

## Maintenance and verification

`node scripts/bubblegum-palette.cjs` pairs new literal colors with dark variants. Existing tokens are preserved; their values are defined in the palette stylesheet.

`node scripts/bubblegum-theme-check.cjs` runs against `http://127.0.0.1:3108` by default (`THEME_TEST_URL` overrides it). The test intercepts account/API traffic with fixtures; it does not exercise real payments or accounts. Screenshots are saved outside the repository in `../vault-mistress-theme-check` (`THEME_TEST_OUTPUT` overrides it). It checks desktop/tablet/mobile layout, theme persistence, OS preference, cross-tab synchronization, and reduced motion.

No SQL migration or new production environment variable is needed.

## Animation and responsive review — 2026-10-12

- Breath uses a uniform 0.4% scale and 1px lift on a separate compositor layer; no animated drop-shadow or vertical stretching. It waits for the image to load and pauses outside the viewport or in a hidden document.
- The measured 1x desktop request is the 82,830-byte WebP, rather than the 237,082-byte source. A network check confirmed that the original was not also downloaded. Higher density displays retain larger sources.
- Corrected legacy image offsets in the Cases and Money Shop destination cards, matched the 1024px/touch-tablet breakpoint, and compacted narrow mobile headers to accommodate notification, theme and account controls.
- Removed backdrop blur from the mobile dock.
- Production build, targeted ESLint, theme preference/reduced-motion checks passed. `scripts/bubblegum-layout-check.cjs` checked 11 sections at 320, 390, 768, 1024, 1280 and 1600px, six isolated game-dialog sizes, and a notification-header fixture: 73 layouts, no reported horizontal overflow or page errors. Reports/screenshots live outside the repository in `../vault-mistress-layout-check`.
- Game-dialog tests use the real CourtGames component in guest simulation, with a simple image adapter. Account/API traffic is mocked. Live payments, authenticated Pet/admin screens and physical-device performance are outside this verification.
- Short local animation samples reported no long tasks. Frame timing varied between runs; these are not a universal FPS guarantee.
