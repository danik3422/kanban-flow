# Run KanbanHub yourself

KanbanHub runs on your own computer or server with Docker: the web app, the API,
live updates and the database, all at one address. Every feature works, with or
without internet. Your data never leaves your machine.

The same guide is on the website at **/self-hosting**, in English, Ukrainian and Russian.

- [What you need](#what-you-need)
- [Install in three commands](#install-in-three-commands)
- [Open it from other devices](#open-it-from-other-devices)
- [Your own domain with HTTPS](#your-own-domain-with-https)
- [Without internet](#without-internet)
- [Email (optional)](#email-optional)
- [Who can sign up](#who-can-sign-up)
- [Admin commands](#admin-commands)
- [Update](#update)
- [Back up and restore](#back-up-and-restore)
- [All settings](#all-settings)
- [Troubleshooting](#troubleshooting)

## What you need

- Docker with Docker Compose: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  on Windows and macOS, or Docker Engine on Linux.
- 1 GB of free memory and 2 GB of disk space.
- A 64-bit processor with AVX (any computer from the last ten years). On older
  hardware see [Troubleshooting](#troubleshooting).

## Install in three commands

```sh
git clone https://github.com/danik3422/kanban-flow.git
cd kanban-flow
docker compose up -d
```

The first start builds the app and takes a few minutes. Then open
**http://localhost:8080** and create your account. That's it.

No `git`? Download the repository as a ZIP from GitHub, unpack it and run
`docker compose up -d` in that folder.

To change settings, copy the example file and edit it, then run
`docker compose up -d` again:

```sh
cp .env.example .env
```

## Open it from other devices

Phones and computers on the same network can use KanbanHub too. Find the server's
address on the network (for example `192.168.1.20`) and set it in `.env`:

```env
PUBLIC_URL=http://192.168.1.20:8080
```

Run `docker compose up -d`, then open that address on any device.

On plain `http://` everything works except passkeys, which browsers allow only on
`https://` (and on `localhost`). People sign in with their email and password.

## Your own domain with HTTPS

Put a reverse proxy in front of KanbanHub. With [Caddy](https://caddyserver.com),
which gets HTTPS certificates by itself, the whole `Caddyfile` is:

```
kanban.example.com {
	reverse_proxy localhost:8080
}
```

and in `.env`:

```env
PUBLIC_URL=https://kanban.example.com
TRUST_PROXY=1
SIGNUP=closed
```

`SIGNUP=closed` keeps strangers out once your account exists; see
[Who can sign up](#who-can-sign-up). nginx and Traefik work the same way: forward
everything, including WebSocket upgrades, to port 8080.

## Without internet

KanbanHub needs no internet to run: fonts, icons and every feature come with it, and
pictures people upload are stored on the server. Turn off the one feature that
looks for photos online:

```env
REMOTE_PHOTOS=false
```

People still pick colours or upload their own photos for board backgrounds.

To install on a machine that has no internet at all, prepare the images on one that
does and carry them over:

```sh
# On a computer with internet, in the kanban-flow folder:
docker compose build
docker pull mongo:8.0
docker save kanbanhub:latest mongo:8.0 | gzip > kanbanhub-images.tar.gz
```

Copy `kanbanhub-images.tar.gz` and the `kanban-flow` folder to the offline machine, then:

```sh
docker load < kanbanhub-images.tar.gz
docker compose up -d --no-build
```

Without internet, sign-in with Google, Microsoft or Apple and the photo search are
not available. Everything else works.

## Email (optional)

Without email (the default):

- new accounts are ready at once, with no confirmation step;
- invitations work by link: copy it from **Share** and send it however you like;
- forgotten passwords are reset by the admin (see [Admin commands](#admin-commands));
- notifications show in the app, under the bell.

With email you also get confirmation emails, password-reset links, emailed
invitations and notification emails. Any SMTP server works: your mail provider or
one on your network. In `.env`:

```env
MAIL_FROM=KanbanHub <kanban@example.com>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=kanban@example.com
SMTP_PASS=your-password
```

Use `SMTP_PORT=465` with `SMTP_SECURE=true` if your provider asks for it.

## Who can sign up

By default anyone who can open the address can create an account, which suits a
home or office network. For a server reachable from the internet:

```env
SIGNUP=closed
```

Then only the very first account (yours) signs up by itself; you add everyone else:

```sh
docker compose exec app npm run create-user -- anna@example.com
```

## Admin commands

Run these in the `kanban-flow` folder.

| What | Command |
|---|---|
| Add an account (prints a password) | `docker compose exec app npm run create-user -- name@example.com` |
| Reset a password (prints a new one) | `docker compose exec app npm run reset-password -- name@example.com` |
| See the logs | `docker compose logs -f app` |
| Stop | `docker compose down` |
| Start again | `docker compose up -d` |

## Update

```sh
git pull
docker compose up -d --build
```

Your boards, accounts and pictures are kept in Docker volumes and survive updates.

## Back up and restore

Everything lives in two Docker volumes: the database (`mongo-data`) and the
uploaded pictures plus the session key (`app-data`).

Back up:

```sh
docker compose exec -T mongo mongodump --archive --gzip > kanbanhub-db.gz
docker compose run --rm --no-deps --user root -v "$PWD":/backup --entrypoint tar app czf /backup/kanbanhub-files.tgz -C /data .
```

Restore on a fresh install (after `docker compose up -d`):

```sh
docker compose exec -T mongo mongorestore --archive --gzip --drop < kanbanhub-db.gz
docker compose run --rm --no-deps --user root -v "$PWD":/backup --entrypoint tar app xzf /backup/kanbanhub-files.tgz -C /data
docker compose restart app
```

## All settings

All optional, in `.env` (see `.env.example`):

| Setting | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port on this machine |
| `PUBLIC_URL` | `http://localhost:PORT` | The address people open; `https://` turns on secure cookies |
| `TRUST_PROXY` | `0` | Set to `1` behind a reverse proxy |
| `SIGNUP` | open | `closed`: only the first account signs up itself |
| `REMOTE_PHOTOS` | `true` | `false`: no online photo search (servers without internet) |
| `MAIL_FROM`, `SMTP_*` | — | Email through any SMTP server |
| `EMAIL_VERIFICATION` | automatic | `required` or `off`; automatic means "only when email is set up" |
| `CLOUDINARY_*` | — | Store pictures in Cloudinary instead of the server |
| `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT` | — | Google, Microsoft and Apple sign-in (needs internet) |
| `JWT_SECRET` | created on first start | The key sessions are signed with, kept in `app-data` |

## Troubleshooting

**The page doesn't open.** Check that both containers run: `docker compose ps`.
Another program may use port 8080: set `PORT=8090` in `.env` and run
`docker compose up -d`.

**I can't stay signed in.** `PUBLIC_URL` must match the address in the browser,
including `http` or `https`. Over plain `http`, don't put `https` in `PUBLIC_URL`.

**The database stops at once with "illegal instruction".** MongoDB 8 needs a
processor with AVX. On older machines change `image: mongo:8.0` to
`image: mongo:4.4` in `docker-compose.yml` before the first start.

**Passkeys are missing in Settings.** Browsers allow passkeys only on `https://`
addresses and `localhost`.
