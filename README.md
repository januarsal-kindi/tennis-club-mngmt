# Tennis Club Management

Phase 1 single-club product: admin + customer portals, one backend.

## Sources of truth
- PRD: https://app.notion.com/p/3dd47917235a81d6beaac99ea3e21b72
- Architecture: https://app.notion.com/p/3dd47917235a81d29b99c2b92aad8e24
- Engineering tasks: https://app.notion.com/p/3dd47917235a8161971af5a77c7503a1

## Conventions
- Skill: `.cursor/skills/ponytail/SKILL.md` ([upstream](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md))
- FE: `.cursor/rules/feature-sliced-design/`
- BE: `.cursor/rules/architecture.mdc`
- After every task: run the project linter before done/PR

## Monorepo layout

```
apps/api/     — NestJS REST API (BE-1+)
apps/web/     — Next.js dual portals (FE-1+)
packages/shared/ — Shared Zod schemas/types
```

## Running the API

### Prerequisites
- Node ≥ 20, pnpm ≥ 9
- PostgreSQL 16 running locally (or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Copy env and fill in DATABASE_URL (and change the seed admin password)
cp apps/api/.env.example apps/api/.env

# Generate Prisma client
pnpm --filter @tennis-club/api db:generate

# Run migrations (creates the DB schema)
pnpm --filter @tennis-club/api db:migrate

# Start the API in dev mode (watch)
pnpm --filter @tennis-club/api dev
```

The API starts at http://localhost:3001.

- Health check: `GET http://localhost:3001/api/v1/health`
- OpenAPI docs: http://localhost:3001/api/docs

On first start the API bootstraps:
- a single `club_settings` row (`CLUB_NAME`, `CLUB_TIMEZONE`, `CLUB_WEEK_START`) if missing
- an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` if that email is not already in `users`

### Auth (BE-2)

Email + password. Nest session cookie (`tc_session`, HttpOnly) — not Auth.js/Better Auth (those are Next.js-first; this is the smallest Nest path). `Authorization: Bearer <token>` is also accepted.

| Method | Path | Who |
|---|---|---|
| `POST` | `/api/v1/auth/register` | public — creates a **member**, sets session cookie |
| `POST` | `/api/v1/auth/login` | public |
| `POST` | `/api/v1/auth/logout` | public (clears cookie / revokes session) |
| `GET` | `/api/v1/me` | authenticated — returns `{ id, email, name, role, createdAt }` |
| `GET` | `/api/v1/hello` | authenticated |
| `GET` | `/api/v1/admin/hello` | **admin** |
| `GET` | `/api/v1/club-settings` | authenticated |
| `PATCH` | `/api/v1/club-settings` | **admin** — `name`, `timezone` (IANA), `weekStart` (`0` or `1`) |

Example (seed admin from `.env.example`):

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"changeme-admin"}'

curl -b cookies.txt http://localhost:3001/api/v1/me
curl -b cookies.txt http://localhost:3001/api/v1/admin/hello
curl -b cookies.txt -X PATCH http://localhost:3001/api/v1/club-settings \
  -H 'Content-Type: application/json' \
  -d '{"timezone":"America/Los_Angeles"}'
```

Self-register is **member** only. Coaches/admins are seeded or provisioned later.

### Lint

```bash
pnpm lint
```

### Database helpers

```bash
# Create a new migration after schema changes
pnpm --filter @tennis-club/api db:migrate

# Deploy migrations in CI/production
pnpm --filter @tennis-club/api db:migrate:deploy

# Regenerate Prisma client after schema changes
pnpm --filter @tennis-club/api db:generate
```
