# Ship or Sink MCP Server

A local MCP server connecting an AI assistant to four business applications: Change Management, Tick PM, OKR Dashboard, and Vault.

The product experiment is practical: let an assistant find context in one application and help carry work into another, without requiring the user to manually copy every record.

## Implemented tools

The TypeScript source registers **36 tools** across five modules:

| Module | Tools | Examples |
| --- | ---: | --- |
| Change Management | 11 | Read projects and stakeholders; update scores; add milestones and notes |
| Tick PM | 8 | Read workspaces and boards; create, update, move, and delete tasks |
| OKR Dashboard | 9 | Read objectives and key results; record check-ins; update progress |
| Vault | 6 | Find folders and documents; search, create, and update documents |
| Cross-app | 2 | Create tasks from stakeholder-score filters; add an OKR reference to a task description |

The OKR link is text written into a task description, not a database-enforced relationship. Stakeholder filters operate on recorded scores; a low score alone does not establish why someone needs support.

## Architecture and trust boundary

`src/index.ts` registers tools with the MCP SDK and connects through stdio. Tool schemas use Zod; handlers query Supabase through a shared client.

This is a **trusted, single-user local integration**. It uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS, and one configured `SOS_USER_ID` for the whole process. Some queries filter on that ID, but this is not a complete authorization boundary: not every relationship lookup or mutation proves ownership. There is no OAuth login, per-caller identity, approval service, or multi-tenant security model in this server.

Tool calls can write and delete real records. Use a disposable database when exploring the code. A hosted version would need verified caller identity, scoped credentials or RLS-respecting access, ownership checks, and auditable write controls before serving multiple users.

## Local setup

```sh
npm ci
npm run build
```

The server expects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SOS_USER_ID` in its process environment. It does not load a `.env` file automatically. Supply variables through your local MCP client's protected configuration or your shell; do not commit real credentials.

Before running, set `SOS_USER_ID` to the UUID of your test database user and provision compatible tables for the four apps. This project does not contain a complete database bootstrap.

Configure a stdio MCP client to launch `node` with the absolute path to `dist/index.js`, then supply the three environment variables privately. `npm start` launches the same server.

## Example workflows

- Find stakeholders below a selected ADKAR threshold and create follow-up tasks on a chosen board.
- Read an objective and add its key-result reference to a task.
- Retrieve a document from Vault alongside a project's stakeholder context.

## Verification and status

`npm run build` checks TypeScript compilation. No automated test suite is defined in this package. Tool registration in source does not establish that every workflow has been tested against the current live schema.

This project demonstrates cross-app agent integration and exposes the governance work needed to turn a personal tool into a shared platform.

Built by Brandon Mann as part of [Ship or Sink](https://shiporsink.ai).

## Public source preparation

The original personal user ID was replaced with required environment configuration for this public source snapshot. This does not add per-caller authorization. Credentials, local client configuration, generated output, and dependencies are excluded.
