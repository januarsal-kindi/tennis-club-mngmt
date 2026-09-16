# FSD v2.1 Reference

Detailed rules for [Feature-Sliced Design](https://feature-sliced.design/).
Condensed from the project's FSD v2.1 guidance. Read the section that applies;
don't preload everything.

## 1. Layers (top → bottom)

| Layer | Responsibility | May import from |
| --- | --- | --- |
| `app` | Init, providers, routing, global theme | pages, widgets, features, entities, shared |
| `pages` | Route screens; own their own logic | widgets, features, entities, shared |
| `widgets` | Large composite UI blocks reused across pages | features, entities, shared |
| `features` | Reusable user interactions (2+ uses) | entities, shared |
| `entities` | Reusable domain models (2+ uses) | shared |
| `shared` | Infrastructure, no business logic | (nothing above) |

`processes/` is deprecated — do not add it.

## 2. Quick placement table

| Scenario | Single use | Confirmed multi-use |
| --- | --- | --- |
| User profile form | `pages/profile/ui/ProfileForm.tsx` | `features/profile-form/` |
| Product card | `pages/products/ui/ProductCard.tsx` | `entities/product/ui/ProductCard.tsx` |
| Product data fetching | `pages/product-detail/api/fetch-product.ts` | `entities/product/api/` |
| Auth token / session | `shared/auth/` (always) | `shared/auth/` (always) |
| Auth login form | `pages/login/ui/LoginForm.tsx` | `features/auth/` |
| CRUD operations | `shared/api/` (always) | `shared/api/` (always) |
| Generic Card layout | — | `shared/ui/Card/` |
| Date formatting util | — | `shared/lib/format-date.ts` |

## 3. Architectural rules (MUST)

- **3-1 Downward imports only.** No upward imports, no same-layer cross-imports.
- **3-2 Public API via `index.ts`.** External consumers import only from a
  slice's `index.ts`. `shared` defines a public API per segment
  (`shared/ui/index.ts`, …), not one top-level barrel. If a single `index.ts`
  can't preserve a runtime boundary, add an env-specific entry (`index.server.ts`).
- **3-3 No cross-imports** between slices on the same layer (see §7).
- **3-4 Domain-based file names.** `model/user.ts`, not `model/types.ts`.
- **3-5 No business logic in `shared/`.** Move domain calculations to
  `entities/` or higher. Shared holds UI kit, utils, API client, route
  constants, assets only.

Breaking a rule is allowed only as an intentional design decision — document the
reason in code (comment or ADR).

## 4. Recommendations (SHOULD)

- **Pages First.** Keep large single-page UI, page-specific forms/validation/
  fetching/state, and page-specific business logic in the page. Extract only on
  confirmed active reuse.
- **Be conservative with entities.** Start without them; `shared + pages + app`
  is valid FSD. CRUD → `shared/api`. Auth tokens/login DTOs → `shared/auth` or
  `shared/api`. Business logic does not automatically require an entity.
- **Start minimal**, add layers only when an actual use case requires them.

## 5. Segments & structure

Segments: `ui/`, `model/`, `api/`, `lib/`, `config/`.

- `app` and `shared`: **no slices** — organized by segments; segments may import
  from each other.
- `pages`, `widgets`, `features`, `entities`: **slices first**, then segments.
- Slice groups: an optional group folder may hold related slices on the same
  layer for navigation only — no segments, no public API.

File naming: domain-based (`api/fetch-profile.ts`). If a segment has one domain
concern, the filename may match the slice (`features/auth/model/auth.ts`).

## 6. Shared layer

Organized by segments only (no slices):

- `ui/` — UI kit (Button, Input, Modal, Card)
- `lib/` — utilities (formatDate, debounce, classnames)
- `api/` — API client, route constants, CRUD helpers, base types
- `auth/` — tokens, login utilities, session
- `config/` — env vars, app settings
- `assets/` — branding assets shared app-wide (use sparingly)

May contain application-aware code (routes, endpoints, branding, common types).
Never business/feature/entity-specific logic.

## 7. Cross-import resolution

Cross-imports are a code smell, not an absolute ban. Treat any deliberate one as
a documented choice.

**Entities layer:** prefer **boundary merge**. `@x` is a last-resort compromise
for the entities layer only, used when boundaries genuinely can't merge —
document why. Don't overuse it.

**Features & widgets — pick by context:**

- **A — Slice merge:** two slices always change together → merge.
- **B — Push to entities:** shared domain logic → `entities/`, keep UI in place.
- **C — Compose from upper layer (IoC):** parent (`pages`/`app`) imports both
  slices and wires them via render props, slots, or DI.
- **D — Public API access:** unavoidable reuse only through the slice's
  `index.ts`, never internal files.

Strictness scales with project context: early-stage products may tolerate some
cross-imports for speed; long-lived/regulated systems should stay strict.

## 8. Anti-patterns (AVOID)

- Creating entities prematurely / for single-use data.
- Putting CRUD in entities (use `shared/api`).
- Creating a `user` entity just for auth data (use `shared/auth`).
- Abusing `@x` (entities-only, last resort).
- Extracting single-use code.
- Technical-role file names (`types.ts`, `utils.ts`).
- Adding UI to entities that other entities then cross-import.
- God slices — split broad responsibilities (`user-management/` →
  `auth/`, `profile-edit/`, `password-reset/`).
- Top-level `assets/` — place static assets next to the code that uses them;
  shared reuse → `shared/ui`; global stylesheets/fonts → `app/`.

## 9. Tooling

- Path alias: `@/*` → `src/*` so imports read `import { Chat } from "@/entities/chat"`.
- Steiger (official linter): `npm i -D @feature-sliced/steiger && npx steiger src`.
  Key rules: `insignificant-slice`, `excessive-slicing`. Add only if the project
  already runs linting.
