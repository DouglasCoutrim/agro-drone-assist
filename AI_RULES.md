# AI_RULES.md

Project: **agro-drone-assist** — multi-tenant operational SaaS (service orders, stock,
inventory, finance, quotes, NFS-e, technician commissions). UI copy is **Portuguese (pt-BR)**.

## Tech Stack

- **React 18 + TypeScript** SPA built with **Vite** (SWC plugin); source lives in `src/`.
- **React Router v6** — keep all route definitions in `src/App.tsx`; pages in `src/pages/`, components in `src/components/`.
- **Tailwind CSS** for all styling, with theme tokens exposed as CSS variables in `src/index.css`.
- **shadcn/ui + Radix UI** for components (already installed under `src/components/ui/`).
- **Supabase** (PostgreSQL + Auth + RLS + RPC) as the backend, accessed via `@supabase/supabase-js`.
- **TanStack Query** for server-state caching and refetching alongside the Supabase client.
- **react-hook-form + Zod** (`@hookform/resolvers`) for all forms and validation.
- **recharts** for charts, **lucide-react** for icons.
- **Vitest** for unit tests (`*.test.ts`); **drizzle-kit/orm** retained for migration tooling only.
- App engines (PDF, CSV, XML) run **client-side**: `jspdf` + `html2canvas`, `papaparse`, custom NFS-e/SEFAZ XML parsers.

## Library Rules — what to use for what

**UI & styling**
- Use existing **shadcn/ui** components from `src/components/ui/` before building anything new. Do **not** edit those files — create a new component in `src/components/` when a variant is needed.
- Style **only** with Tailwind utility classes. Merge conditional classes with `cn` from `@/lib/utils`. Reuse the `premium/` wrappers (`PremiumCard`, `KpiCard`, `PremiumTable`, `AlertBox`) for dashboard/list surfaces.
- Use **lucide-react** for all icons — no other icon sets. Theme switching goes through `useTheme`.

**Data & backend**
- Talk to the backend with the shared client at `@/integrations/supabase/client` (`supabase`). Wrap reads in **TanStack Query** hooks when caching/revalidation matters.
- Every tenant-scoped query **must** filter by `organization_id`; never return cross-organization rows.
- Prefer **Supabase RPCs** (SECURITY DEFINER) for privileged/aggregate logic; rely on **RLS** for authorization. Enforce RBAC in `ProtectedRoute` (`requiredPermission` / `requiredRole`) and mirror it at the DB layer.
- Persist auth flows through `useAuth` and `ProtectedRoute`; never query the DB without going through RLS.

**Forms & input**
- Build forms with **react-hook-form** + a **Zod** schema resolved by `@hookform/resolvers`. Use the shadcn `Form` primitives.
- Format/validate CPF, CNPJ, phone, currency and dates with `src/lib/formatters.ts` — do not reimplement.

**Feedback & notifications**
- Use **sonner** for user-facing toasts and the shadcn toast primitives for in-app alerts. Convert raw errors to friendly messages with `getErrorMessage` from `@/lib/formatters`.

**Charts, PDF, files**
- Charts **must** use **recharts**. Client-side PDFs use **jspdf** (+ `html2canvas` for capture) with a shared `pdf-padrao` style. CSV uses **papaparse**. Dates use **date-fns**.

**Testing & quality**
- Add **Vitest** unit tests (`*.test.ts`) for pure logic in `src/lib/`. Keep TypeScript strict and clear `npm run lint`.
- Do **not** add new dependencies for something an installed library already covers.

## Project conventions
- Add source only in `src/`; pages in `src/pages/`, components in `src/components/`, logic/hooks in `src/lib/` and `src/hooks/`.
- Add every new page to the routes in `src/App.tsx`; lazy-load heavy authenticated pages (keep entry pages eager).
- Update `src/pages/Index.tsx` so new components are actually visible.
- Record notable technical decisions in `AGENTS.md` and keep `CONTEXTO.md` current at session end.
