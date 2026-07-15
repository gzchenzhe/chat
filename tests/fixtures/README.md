# Regression fixtures

- `export-baseline-state.json` is the deterministic state used to generate the reference PNG.
- `all-message-types-state.json` covers every currently supported message type.
- The SVG files are editable sources for the deterministic PNG images used by both fixtures. The PNG variants avoid platform-specific SVG MIME handling during local static serving.

Load a fixture by clearing `wechat_editor_state_v19`, then storing the fixture JSON under legacy key `wechat_editor_state_v18` before opening or reloading the application. This also exercises the v18-to-v19 migration path. Generated reference images belong in `tests/baseline/`; transient test output belongs in `test-results/` and is ignored by Git.
