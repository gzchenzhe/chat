# Manual regression record

## 2026-07-15 baseline

Environment: Codex in-app Chromium browser against `http://127.0.0.1:8188/`.

### Passed

- The home, editor, and preview pages load and can be selected from the bottom navigation.
- `tests/fixtures/all-message-types-state.json` renders all eight supported message types.
- Adding and editing a text message updates `wechat_editor_state_v19`; the message remains after a reload.
- Dark mode updates both the preview and persisted state, and can be restored to light mode.
- The normal two-step export flow generates a visually reviewed `1125 × 2436` PNG from the deterministic export fixture.
- The generated PNG contains the expected local avatars and message image.
- At a `390 × 844` viewport, all three pages stay within a `390` px document width, the bottom navigation remains visible, and the phone preview is scaled inside the page.
- At a `412 × 915` viewport, all three pages stay within a `412` px document width, the bottom navigation remains visible, and the phone preview is scaled inside the page.
- No new warning or error was logged while exporting the PNG fixtures. Earlier SVG fixture warnings were resolved by using deterministic PNG variants for runtime tests.
- The per-message up/down controls reorder messages, persist the changed order, and can restore the original fixture order.
- At a `390` px viewport, all eight message toolbars remain inside their cards and the dedicated drag handle reports `touch-action: none`.
- A legacy `wechat_editor_state_v18` fixture migrates to schema version 3 under `wechat_editor_state_v19`; the old opponent becomes `other1`, legacy `isMe` values become message `senderId` values, and the legacy key is removed only after the new state is saved.
- The home page exposes three opponent nickname inputs and four avatar positions (me plus three opponents) without horizontal overflow at a 390 px viewport.
- Each user message exposes one exclusive sender choice for the three dynamically named opponents and “是我发出的”. Choosing opponent 2 updates the preview nickname/avatar and persists `senderId: other2` with `isMe: false`.
- Legacy avatar and message Data URLs migrate to three IndexedDB assets. The lightweight v19 state omits the inline bytes, and all images hydrate again after reload.
- A portable backup inlines the referenced images, clears IndexedDB asset IDs, changes and restores the test chat name successfully, and preserves all three stored assets.
- The `480 × 320` PNG compression fixture is resized to `160 × 107`, reduced from 24,620 to 5,604 bytes, and survives an IndexedDB write/read cycle.
- The data-management backup button is present and can be invoked. Backup payload creation and import application were verified independently because the in-app browser did not expose the Blob download as a downloadable event.
- The preview page generates one `1125 × 2436` PNG that is reused by both download and system-share actions; the deprecated second rendering pipeline has been removed.
- The unified download action produces an `image/png` file with a timestamped Chinese filename. The browser reports file-share support and exposes the separate system-share button without invoking the native share sheet during automated testing.
- Pixel comparison against the visual baseline changed 841 of 2,740,500 pixels (about 0.031%, mean channel delta 0.0047) while preserving the exact dimensions.
- After extracting the inline code, `css/app.css` and `js/app.js` both load, all local fonts report ready, Vue mounts successfully, and the export retains the same dimensions and pixel-diff result.
- The Cloudflare `.assetsignore` audit leaves 50 runtime files totaling 12,895,968 bytes; the largest included file is 5,798,120 bytes and no included asset exceeds the 25 MiB Workers limit. `node_modules/` is explicitly excluded.

### Not covered by viewport simulation

- Physical iOS Safari and Android Chrome touch behavior. Pointer-based handle sorting is implemented, but the test browser cannot inject native touch input; the up/down controls are the verified mobile fallback.
- PWA installation, cache upgrade, and fully offline startup.
- Native file-picker behavior, backup file selection, and large real-world uploads.
- Native download permissions and Web Share behavior.
- Screen-reader and keyboard-only accessibility review.

Viewport simulation is a layout check, not a substitute for physical-device acceptance testing.

## Automated regression

`npm test` runs 140 deterministic project checks followed by five Playwright Chromium tests. The suite covers v18-to-v19/schema 3 migration, named group-participant sender selection and persistence, three-page navigation, accessible message sorting with reload persistence, 390 px mobile containment, 1125 × 2436 PNG generation, and JSON backup download. All five browser tests passed on 2026-07-15.
