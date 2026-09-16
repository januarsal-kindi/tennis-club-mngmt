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

## Intended layout
Monorepo: `apps/web` (Next.js dual portals) + `apps/api` (NestJS) + PostgreSQL.
