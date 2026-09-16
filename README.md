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
apps/web/     — Next.js dual portals (FE-1+, not yet)
packages/shared/ — Shared Zod schemas/types
```

## Running the API (BE-1)

### Prerequisites
- Node ≥ 20, pnpm ≥ 9
- PostgreSQL 16 running locally (or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Copy env and fill in DATABASE_URL
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
