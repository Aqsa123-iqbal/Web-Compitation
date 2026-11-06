# VSpark Web Development Competition Portal

A standalone React + Vite portal that uses the live VSpark site as visual reference. It does not reuse VSpark source code. The app can be mounted later under a larger VSpark site at `/web-development-competition`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/web-development-competition`. Copy `.env.example` to `.env.local` and configure Supabase for persistent data/uploads. Without Supabase, the portal clearly runs in browser-only demo mode. Demo organizer: `admin@vspark.demo` / `SparkDemo26!`; never use demo mode for real accounts.

## Implemented portal features

- Competition listing, protected registered-participant details, admin competition catalog, rich task/rules/details editors, dates, status and organizer Drive folder link.
- Participant profile, 120-minute timer, project links, rich project description, multiple resource uploads, judge-facing Drive link draft save, and secure final submission deadline check through a Supabase RPC.
- Supabase Storage uploads for multiple local files/folders and database metadata in `competition_resources`.
- Google Picker import UI for multiple Drive files/folders. Requires the three `VITE_GOOGLE_*` values. Picker saves Drive IDs/metadata only; it does not copy Google Drive content to Supabase or enumerate folder contents.
- Admin resource categories, descriptions, visibility, enable/disable, replacement, delete and signed open/download links; participant resource access follows RLS.
- Participant roster, payment review, 100-mark evaluation, winner status, CSV/print export, password reset, and an explicit disabled state for unconfigured bulk email.
- Participant profile pictures and their Supabase storage bucket/column were removed by the schema cleanup. Other participant fields remain.

## Database, APIs and deployment

See [`SETUP_GUIDE.md`](SETUP_GUIDE.md) for exact Supabase, OAuth/Picker, file storage and Vercel setup instructions. Run [`supabase/schema.sql`](supabase/schema.sql) in a new Supabase project. It contains RLS, storage policies, resource metadata, a restricted public competition catalog, an authorized competition-details RPC, timer/submission RPCs and a starter competition.

Environment variable names are in [`.env.example`](.env.example). No service-role key or Google OAuth client secret belongs in the browser app.

## Not connected / limitations

- A Supabase project has not been created/configured in this workspace; database/storage behavior cannot be live-tested until credentials are supplied.
- Google Picker/OAuth code requires a Google Cloud project and has not been tested with user credentials. Folder selection records the folder itself; it does not import every file inside it. There is no automatic upload into an organizer's Google Drive.
- The app currently records one legacy participant registration per auth account. The normalized schema supports multiple competition registrations and enforces a maximum of two, but the existing-account join workflow still needs wiring through the participant UI.
- Bulk announcement email, Google Sheets synchronization and payment processing are not connected. The portal does not claim these actions succeeded.
- The 100-mark rubric is manually scored by the organizer. External APIs listed by a participant are saved for judges; this portal does not call them.
- The Vite production build emits a large JavaScript chunk warning; the build still succeeds.
