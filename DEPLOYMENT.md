# KanbanHub deployment

## Production domains

- Frontend: `https://kanbanhub.app`
- Backend: `https://api.kanbanhub.app`

Deploy the `frontend` directory as a Render Static Site and the `backend`
directory as a Render Web Service. Use `npm install && npm run build` and
`dist` for the frontend. Use `npm install` and `npm start` for the backend.

## DNS

Add the custom domains in Render first. Then create the CNAME records shown by
Render for the root domain and `api` at the DNS provider for `kanbanhub.app`. Keep the
root-domain redirect or landing configuration provided by Render.

## Backend variables

Copy `backend/.env.production.example` into the backend service variables.
Set real values for `MONGO_URI`, `JWT_SECRET`, `BREVO_API_KEY`, Firebase
Admin credentials, and the three Cloudinary credentials:
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Keep `ALLOW_MEMORY_DB=false` and leave `MAIL_REDIRECT_TO` empty.

## Cloudinary avatars

Create a Cloudinary account and open **Dashboard**. Copy these values into the
Render backend environment variables:

- `CLOUDINARY_CLOUD_NAME` from the Cloud name field
- `CLOUDINARY_API_KEY` from the API Key field
- `CLOUDINARY_API_SECRET` from the API Secret field

The app accepts JPG, PNG, and WebP files up to 5 MB, compresses them in the
browser, and sends at most 70 KB to the backend. Images are limited to 512 px
and uploaded to the `avatars` folder. Do not put Cloudinary secrets in frontend
variables or commit them to git.

MongoDB must be Atlas or another replica set because member removal uses a
transaction.

## Frontend variables

Copy `frontend/.env.production.example` into the frontend service variables.
Set the Firebase web configuration values. Keep `VITE_DEV_AUTH_BYPASS=false`.
Use the exact `authDomain` from the Firebase web app configuration, usually
`YOUR_PROJECT_ID.firebaseapp.com`. Use `kanbanhub.app` there only if a Firebase
custom auth domain has been configured explicitly.

## Firebase

Enable the required providers in Firebase Authentication and add
`kanbanhub.app` to Firebase Authorized Domains. Configure OAuth callback
URLs for Google, Microsoft, and Apple in their provider consoles.

## Email DNS

Verify `kanbanhub.app` in Brevo and publish its SPF/DKIM records. Use
`noreply@kanbanhub.app` for automated messages and
`support@kanbanhub.app` for replies.

## Health check

Configure the Render backend health check as:

```text
/health
```

It should return HTTP 200 with `{ "status": "ok" }`.

## Final checks

```bash
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```