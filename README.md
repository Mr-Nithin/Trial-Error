# Trial-Error — Arc

Arc is version control for real-life activities: record a run, compare versions, and branch from any step.

- **Live demo (mock data):** https://mr-nithin.github.io/Trial-Error/ — runs entirely in the browser; changes reset on reload.
- **Full app:** Next.js frontend + Fastify API + Postgres + MinIO, run with Docker Compose.

## Architecture

```
browser ──▶ web (Next.js, :3000) ──/api/*──▶ api (Fastify, :4000) ──▶ Postgres
              proxy.ts route guard            middleware: auth, CSRF,     └──▶ MinIO (S3) for photos/videos
                                              rate limit, validation…
```

| Folder | What it is |
| --- | --- |
| `web/` | Next.js 16 app. `src/lib/backend/` has two backends behind one interface: `http.ts` (real API) and `mock.ts` (in-memory, used by the Pages demo via `NEXT_PUBLIC_DATA_MODE=mock`). `src/proxy.ts` redirects signed-out visitors to `/login`. |
| `api/` | Fastify 5 + TypeScript. Drizzle ORM migrations in `api/drizzle/`. Middleware lives in `api/src/plugins/` (logging, helmet, CSRF, rate limits, session auth, validation, errors). Business logic in `api/src/services/`. |
| `shared/api-types.ts` | The HTTP contract (request/response types) imported by both sides. |

Only the web container is exposed; the API is reached through the web app's `/api` rewrite, so session cookies are first-party.

## Run everything with Docker

```bash
cp .env.example .env   # change the secrets before deploying anywhere
docker compose up --build
```

Open http://localhost:3000 and sign up. Data lives in the `db-data` and `media-data` volumes.

To load demo data (`demo@arc.app` / `arcdemo123`), run the seed from your machine against the compose database, or locally as below.

## Develop locally

Needs Node 22, a Postgres, and any S3-compatible store (MinIO, or an emulator).

```bash
# API
cd api
cp .env.example .env          # point DATABASE_URL / S3_* at your services
npm install
npm run dev                   # http://localhost:4000, runs migrations on start
npm run seed                  # optional demo user + projects
npm test                      # integration tests; uses TEST_DATABASE_URL (default postgres://arc:arc@localhost:5432/arc_test)

# Web (in another terminal)
cd web
npm install
npm run dev                   # http://localhost:3000, proxies /api to localhost:4000
```

Run the web app without a backend: `NEXT_PUBLIC_DATA_MODE=mock npm run dev`.

## API overview

All routes are under `/api` and return JSON (`{ error: { code, message } }` on failure).

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`, `POST /projects/:id/duplicate`, `PUT /projects/:id/goals`, `GET /projects/:id/runs` |
| Versions | `POST /projects/:id/versions`, `GET/PATCH/DELETE /versions/:id`, `POST /versions/:id/duplicate`, `POST /versions/:id/branch` |
| Steps | `POST /versions/:id/steps`, `PATCH/DELETE /steps/:id`, `POST /steps/:id/move` |
| Runs | `POST /versions/:id/runs` |
| Media | `POST /media` (multipart), `GET /media/:id` |

Security: scrypt password hashing, httpOnly SameSite=Lax session cookies (only a SHA-256 of the token is stored), Origin + JSON content-type CSRF checks, per-IP rate limits on login/signup, and every resource is scoped to its owner (other users get 404).
