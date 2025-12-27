## Build & Checks
- `pnpm -s lint` — ✅ passed
- `pnpm -s typecheck` — ✅ passed
- `NEXT_DISABLE_TURBOPACK=1 pnpm -s build` — ✅ passed (Next.js 16.0.10, webpack)
- Optional: `pnpm dlx depcheck` — ran; flagged `@prisma/client`, `@tailwindcss/postcss`, `tailwindcss` as unused (likely false positives).
- Optional: `pnpm dlx ts-prune -p tsconfig.json` — ran; produced unused-export list (see `AUDIT/ORPHANS.md` for highlights).
