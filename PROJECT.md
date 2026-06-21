# Project: Household Chores App User Views (Sistema de Deberes de la Casa)

## Architecture
- Framework: Next.js 16 (App Router) + TypeScript
- Routing: Dynamic route `[usuario]` maps to user profiles.
- Views to implement:
  - `app/[usuario]/layout.tsx` (Contains BottomNavBar for navigation between Home, Ranking, Plan, and Perfil)
  - `app/[usuario]/ranking/page.tsx` (Displays podium + detailed score tables for 4 rankings: General, Confiable, Solidario, Responsable)
  - `app/[usuario]/perfil/page.tsx` (Displays achievements/logros, stats, and historical info)
  - `app/[usuario]/plan/page.tsx` (Displays Plan Semanal, static visual representation of who does what each day)
- Colors/Styling: Tailwind CSS with warmth (bg-crema, bg-crema-card, text-tinta, accent terracota).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | BottomNavBar Layout | Create layout.tsx under app/[usuario] with BottomNavBar | None | DONE |
| M2 | Ranking View | Create ranking/page.tsx with podium + 4 tables | M1 | DONE |
| M3 | Perfil View | Create perfil/page.tsx with achievements + stats | M1 | DONE |
| M4 | Plan Semanal View | Create plan/page.tsx with static weekly grid | M1 | DONE |
| M5 | E2E Tests & Verification | Verify routing, visuals, and compile tests | M2, M3, M4 | DONE |
| M6 | Forensic Audit | Verify code integrity and compliance with design guidelines | M5 | DONE |

## Interface Contracts
- BottomNavBar options:
  - Inicio: `/ [usuario]`
  - Ranking: `/ [usuario] / ranking`
  - Plan: `/ [usuario] / plan`
  - Perfil: `/ [usuario] / perfil`
- Service functions utilized:
  - Rankings: `calcularRankings` from `@/lib/rankings/rankings.service`
  - Profile achievements: `calcularEstadisticas` and `listarLogrosDe` from `@/lib/logros/logros.service` and `@/lib/logros/logros.repo`
  - Weekly Plan: `listarPlanSemanal`, `listarParticipantes`, and `listarDeberes` for rendering the static plan grid.

## Code Layout
- `app/[usuario]/layout.tsx`
- `app/[usuario]/ranking/page.tsx`
- `app/[usuario]/perfil/page.tsx`
- `app/[usuario]/plan/page.tsx`
