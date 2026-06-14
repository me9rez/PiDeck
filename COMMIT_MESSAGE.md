feat: redesign session activity timeline

Summary:
- Replace tool-first session rendering with a compact Activity timeline.
- Keep final assistant answers as the main readable transcript content.
- Preserve process order with thinking, tool, and answer-marker events.
- Distinguish tool call failures from command result warnings such as non-zero exit codes.
- Add focused Activity timeline styles and i18n labels.

Verification:
- npm run typecheck
- npm run build
