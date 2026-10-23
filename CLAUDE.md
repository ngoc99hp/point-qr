@AGENTS.md

# PeerScore — instructions for Claude Code

**Source of truth: [SPEC.md](SPEC.md).** Read the relevant sections before any change. Business rules (§5) must not be changed or inferred; ask when something is ambiguous.

## Rules (SPEC §0)

- Work phase by phase (§14). At the end of each phase run the checks below, summarize, and **stop for confirmation**. Never start the next phase on your own.
- Server Components by default. Validate every input with Zod. Server Actions return `{ success, data?, error? }`. Prisma queries always use an explicit `select`.
- No `any`, `@ts-ignore` or `@ts-expect-error`.
- Do not add libraries outside SPEC §3 (including its allowed secondary list) without asking.
- UI text is Vietnamese. Code, identifiers and commit messages are English.
- Keep the versions pinned in §3; do not bump a major version without asking.
- Conventional commits, one per logical step. From P1 onward, business logic is written test-first.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`typecheck` runs `next typegen` first (global `PageProps`/`LayoutProps`). `build` needs env vars; use `.env.local` (placeholders are fine for builds).

## Conventions already settled (SPEC §17)

- **Next 16:** route protection lives in `proxy.ts`, not `middleware.ts`. It is default-deny, and the public prefixes are listed in `lib/routes.ts`. Proxy is only an optimistic check; pages and actions must call `requireLecturer()` from `lib/auth.ts`.
- **Cache Components is on:** anything that reads `cookies()`, `headers()`, `searchParams` or the session (`auth()`, `requireLecturer()`) must render inside `<Suspense>`. Read `node_modules/next/dist/docs/` for version-specific APIs.
- **Prisma 7:**
  - generator `prisma-client`, output `lib/generated/prisma`; import from `@/lib/generated/prisma/client`.
  - No `url`/`directUrl` in the schema: the CLI uses the direct URL (`DIRECT_URL`, or derived from `DATABASE_URL` by `lib/neon-url.ts`) via `prisma.config.ts`; the runtime uses pooled `DATABASE_URL` via `PrismaNeon` in `lib/db.ts`.
  - Migrations do not auto-generate the client; run `prisma generate` after schema changes.
- **Auth.js v5 (pinned beta), single admin via Credentials (no OAuth):** the provider lives in `lib/auth.ts`; `auth.config.ts` must stay free of Prisma, `lib/env` and other server-only imports. Route handlers use `getCurrentLecturer()` (→ 401), pages/actions use `requireLecturer()`. `session.user.lecturerId` is typed in `types/next-auth.d.ts`. Every lecturer query filters by `ownerId = lecturerId`; another owner's resource returns 404.
- **Env:** import `env` from `lib/env.ts` on the server only. Never log secrets, student codes or names.
- **Decimal:** convert to `number` only in `lib/mappers.ts` (from P1).
- Tests live next to the code as `*.test.ts` (Vitest, node environment, `@/` alias).
