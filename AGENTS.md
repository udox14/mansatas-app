# Workspace execution notes

## Next.js validation on this Windows workspace

- Do not run `npm run build` or plain `next build`. This environment only loads the Next.js SWC WebAssembly fallback, while Turbopack requires unavailable native Windows bindings; the command predictably fails and wastes time.
- Do not investigate or repeatedly report the missing `@next/swc-win32-x64-msvc` binding unless the user explicitly asks to repair the local toolchain.
- Prefer targeted checks for files changed in the current task.
- If a full production compilation is explicitly required, use `npx next build --webpack` directly. Be aware that this environment may still fail later in the Next.js type-check worker with `invalid type: unit value, expected usize`; treat that as an environment/toolchain limitation after confirming webpack compilation succeeded.
- `npx tsc --noEmit` currently reports pre-existing generated `.next/types` errors for `monitoring-kedisiplinan`, `monitoring-penugasan`, and `whatsapp`. Do not attribute those errors to unrelated changes.
