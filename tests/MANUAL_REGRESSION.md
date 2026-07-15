# Manual regression record

## 2026-07-15 baseline

Environment: Codex in-app Chromium browser against `http://127.0.0.1:8188/`.

### Passed

- The home, editor, and preview pages load and can be selected from the bottom navigation.
- `tests/fixtures/all-message-types-state.json` renders all eight supported message types.
- Adding and editing a text message updates `wechat_editor_state_v18`; the message remains after a reload.
- Dark mode updates both the preview and persisted state, and can be restored to light mode.
- The normal two-step export flow generates a visually reviewed `1125 × 2436` PNG from the deterministic export fixture.
- The generated PNG contains the expected local avatars and message image.
- At a `390 × 844` viewport, all three pages stay within a `390` px document width, the bottom navigation remains visible, and the phone preview is scaled inside the page.
- At a `412 × 915` viewport, all three pages stay within a `412` px document width, the bottom navigation remains visible, and the phone preview is scaled inside the page.
- No new warning or error was logged while exporting the PNG fixtures. Earlier SVG fixture warnings were resolved by using deterministic PNG variants for runtime tests.
- The per-message up/down controls reorder messages, persist the changed order, and can restore the original fixture order.
- At a `390` px viewport, all eight message toolbars remain inside their cards and the dedicated drag handle reports `touch-action: none`.

### Not covered by viewport simulation

- Physical iOS Safari and Android Chrome touch behavior. Pointer-based handle sorting is implemented, but the test browser cannot inject native touch input; the up/down controls are the verified mobile fallback.
- PWA installation, cache upgrade, and fully offline startup.
- Native file-picker behavior and large real-world uploads.
- Native download permissions and Web Share behavior.
- Screen-reader and keyboard-only accessibility review.

Viewport simulation is a layout check, not a substitute for physical-device acceptance testing.
