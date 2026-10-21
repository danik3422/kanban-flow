# KanbanHub backend

Express + MongoDB API with Socket.IO live updates. `npm start` runs `index.js`; `npm test` runs the test suite against an in-memory MongoDB.

## Layout

- `index.js` starts the HTTP server: the Express app, the socket server and the email jobs.
- `app.js` builds the Express app: security middleware, `/health` and the `/api` routes.
- `config/` reads and checks environment variables.
- `routes/` maps URLs to handlers, one file per area (`auth/`, `board/`), plus local-only dev routes.
- `controllers/` holds the request handlers, grouped like the routes.
- `services/` holds logic shared by handlers: board access checks, card events, sessions, notifications, limits.
- `models/` has the Mongoose models and the public user fields.
- `validation/` has the Zod request schemas used by `validateBody`.
- `middlewares/` has auth, CSRF, rate limits, body validation, id checks and board loading.
- `emails/` builds and sends email (templates, translations, digests and reminders).
- `realtime/` has the Socket.IO server: socket sign-in, board rooms and presence.
- `lib/` has the infrastructure clients: database, Cloudinary, Firebase Admin and the realtime emitter.
- `scripts/` has one-off migrations and demo data seeds (`npm run migrate:*`, `npm run seed:demo`).
- `test/` has the API tests (`node --test`).

## Migrations

Run these once per environment after deploying the code that needs them:

- `npm run migrate:provider-uids`
- `npm run migrate:password-flags`
- `npm run migrate:email-frequency` keeps email off for people who had turned it off before the email frequency setting existed. The server used to do this on every start.
