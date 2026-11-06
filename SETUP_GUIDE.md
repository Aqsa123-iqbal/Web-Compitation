# VSpark Competition Portal — Setup Guide

This guide describes integrations present in this repository as of November 5, 2026. The portal currently uses Supabase for application data and direct file uploads. Google Drive selection is implemented with Google Picker and Google Identity Services; it only becomes active after the three public Google configuration values below are supplied. Bulk email delivery and Google Sheets synchronization are not implemented and have no environment variables in this project.

## 1. Install and run

1. Install Node.js 22.12+ (Vite 8 requires a current Node version).
2. In the project directory run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill the Supabase values first. Leave Google values blank until its Cloud project is configured.
5. Run `npm run dev` and open `http://localhost:5173/web-development-competition`.
6. After changing environment variables, stop and restart Vite. Vite reads `VITE_` values at startup/build time.

`.env.local` is ignored by Git. Do not put service-role keys, OAuth client secrets, or other server secrets in a `VITE_` variable. The Google API key and OAuth client ID used here are browser identifiers, not secrets; restrict the API key by website referrer and API.

## 2. Supabase: Auth, database, and storage

### Create the project and connect the app

1. Sign in to the Supabase dashboard and create a project. Save the database password securely.
2. In **Project Settings → API** (or **API Keys** in the current dashboard), copy the project URL and the `anon`/publishable key.
3. Set them in `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
   ```

4. Keep the `service_role`/secret key private. The browser app must use the public key and rely on Row Level Security.
5. Restart Vite. When the app connects successfully, `@supabase/supabase-js` uses Supabase Auth, PostgREST (the database API), and Storage.

### Install the database schema and policies

1. Use a fresh Supabase project for the first setup.
2. Open **SQL Editor → New query**.
3. Paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates the profile, legacy participant and competition tables, normalized resource and registration tables, server-side timer/draft/final-submission RPCs, results RPC, starter competition, storage buckets, triggers, and RLS policies.
4. The starter competition uses the current `competition_settings.title` and `task`. Edit it in the admin **Manage competitions** tab after promoting the organizer account.
5. The SQL includes policies for participants to access only their own participant row and resources, for registered users to view registered competition details/resources, and for admins to manage competitions, resources, payments, and evaluations.
6. Do not disable RLS for public tables. The public catalog is a restricted view; protected full competition details come from the `authorized_competition_details` RPC after checking registration/admin access.
7. The schema removes the former profile-picture column and profile-image bucket. If an older project already has profile pictures, running this version of the schema deletes those profile-image objects as part of feature removal; other participant columns are retained.

> The supplied SQL is a setup schema for a new Supabase project. Review existing data and take a database backup before applying it to any populated database.

### Configure Auth

1. Open **Authentication → URL Configuration**.
2. Set the local Site URL to `http://localhost:5173` while developing.
3. Add the deployed site origin and redirect URL to **Redirect URLs**. Password recovery returns to `/web-development-competition/reset-password` under the current site origin.
4. Under **Authentication → Providers → Email**, configure email confirmation according to the university's policy. Supabase's built-in reset/confirmation email requires its Auth email/SMTP configuration for reliable production use.
5. Register one organizer account using the app. In **Authentication → Users**, copy its UUID. Run the promotion SQL comment at the end of `supabase/schema.sql` with that UUID. The role is not editable in the browser.

### Configure Storage

`supabase/schema.sql` creates:

- `payment-proofs` — private, participant upload and owner/admin read policies.
- `competition-files` — private direct competition and project resources. The application accepts files up to 6 MB each and stores each file's metadata in `competition_resources`.

The schema installs `storage.objects` policies. Do not make `competition-files` public. Participant object paths include the competition ID and authenticated user ID; metadata rows associate a file with a competition and, for participant uploads, that participant registration. Google Drive selections store Google file IDs and metadata, not copied files in this bucket.

### Verify Supabase

1. Open the app with both `VITE_SUPABASE_*` values and restart Vite.
2. Create an account with a competition ID selected. If email confirmation is enabled, confirm it before signing in.
3. Sign in, start the timer, save a draft, and submit links. Verify the participant row fields in **Table Editor → participants**.
4. Add a PDF/README through the resources area; verify the object in **Storage → competition-files** and its metadata row in **competition_resources**.
5. Sign in as the promoted organizer and verify competition/resource management, payment review, winner status, and evaluation.
6. Test that a user cannot read another participant's resources or unregistered competition details. Test deadline rejection using the database RPC; the database clock is authoritative in connected mode.

## 3. Google Drive Picker and OAuth

The implemented browser flow loads Google's **Google Identity Services** client (`https://accounts.google.com/gsi/client`) and **Google Picker** library (`https://apis.google.com/js/api.js`). It requests the narrow `https://www.googleapis.com/auth/drive.file` scope when a participant or organizer chooses **Import from Google Drive**. The short-lived access token is held only in memory for that Picker action. The application stores the selected item's Drive ID, name, MIME type, size, and URL in `competition_resources`; it does not store an OAuth token or copy the Drive file into Supabase Storage. The user can reauthorize when the access token expires.

### Create Google Cloud credentials

1. In Google Cloud Console, create/select a project and enable **Google Picker API**. This code uses Picker to browse/select items and does not call the Drive REST API directly. If a future feature lists folder children or downloads file contents, it will also need **Google Drive API** enabled and a separately reviewed scope.
2. Configure **Google Auth Platform → Branding/Audience** (OAuth consent screen). Add the app name, support email, developer contact, and the privacy-policy information required by Google. While the app is in Testing, add the participant/admin Google accounts as test users. Move to Production and complete verification if Google's consent screen requires it for the selected scopes.
3. Go to **Google Auth Platform → Clients → Create client → Web application**.
4. Add authorized JavaScript origins for local development, `http://localhost:5173`, and the exact production origin, for example `https://your-domain.example`. The current GIS popup token flow does not use a redirect URI; do not invent one.
5. Create an API key in **APIs & Services → Credentials**. Under **Application restrictions**, use Websites and allow your exact site origin(s) and `https://docs.google.com/*` (Picker is rendered in a Google iframe). Under **API restrictions**, allow **Google Picker API**. This key is public in the browser bundle, so referrer and API restrictions are required.
6. Copy the OAuth **Client ID**, restricted API key, and Google Cloud **project number** (not project ID) into `.env.local`:

   ```dotenv
   VITE_GOOGLE_CLIENT_ID=YOUR_WEB_OAUTH_CLIENT_ID.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=YOUR_RESTRICTED_GOOGLE_API_KEY
   VITE_GOOGLE_APP_ID=YOUR_GOOGLE_CLOUD_PROJECT_NUMBER
   ```

7. Restart Vite. The Import button is enabled only when Supabase is connected and all three Google values are present.
8. Test with an allowed Google account. Import a folder and several individual files, cancel the Picker, deny consent, and retry after an access token expires. Confirm `competition_resources` rows contain `source='google_drive'`, the correct competition/participant IDs, and Google file metadata. Google Drive sharing still controls whether judges can open a selected item.

The Picker selection records an entire folder as a folder resource by ID; it does not recursively copy/list every child file. The project currently does not use the Drive REST API to enumerate or download folder contents. Automatic upload into an organizer's Drive folder is also not implemented. Participants can still paste the separate judge-facing folder link, while the organizer's upload-folder link remains independently configured per competition.

## 4. Direct file and folder uploads

1. Configure Supabase and run `supabase/schema.sql` before enabling direct uploads.
2. In the participant submission/resource section or the admin's competition resource manager, choose multiple files or a local folder. Supported extensions are PDF, DOC/DOCX, ZIP, common images, text/Markdown/CSV/JSON, and common web source files (JS/JSX/TS/TSX/CSS/HTML/SVG).
3. Files larger than 6 MB each are rejected by the UI. Storage uploads are private and metadata is inserted only after the upload succeeds.
4. Uploaded resource metadata can be categorized, described, enabled/disabled, replaced, opened with a short-lived signed URL, or deleted by authorized users.
5. Folder selection uses the browser's `webkitdirectory` input; folder uploads are uploaded as multiple individual objects while preserving their relative path. Browser support may vary.

## 5. Google Sheets, bulk email, and other APIs

- **Google Sheets:** no Sheets API client, Edge Function, or synchronization is implemented. The previous unused `GOOGLE_SERVICE_ACCOUNT_JSON`/`GOOGLE_SHEET_ID` placeholders have been removed. Do not configure a service account for the current app; there is nothing that will consume it.
- **Bulk announcement email:** no external email provider or sender endpoint is implemented. The admin page deliberately shows sending as unavailable; it does not claim messages were sent. To add this later, choose a provider (for example Resend), verify the university sender domain, create a server-side Edge Function, store its API key as a Supabase Function secret, authorize the caller, and add delivery logging/rate limits. Do not place provider keys in Vite variables.
- **Supabase Auth email:** password reset and account confirmation use Supabase Auth. Configure its SMTP provider under Authentication settings for production deliverability. No separate email API key is consumed by this frontend.
- **Payment gateway:** not connected. Payments are manually reviewed; no gateway credentials are used.
- **Participant-submitted APIs:** the portal stores the API names/URLs participants enter for judging; it does not call those APIs itself.
- **External services actually loaded:** Supabase (`@supabase/supabase-js`), Google Identity Services, Google Picker, and Google Fonts (Inter/Sora). Google APIs only run after Google configuration and user consent.

## 6. Vercel deployment

1. Push the project to a private/public Git repository you control and import it into Vercel.
2. Keep the Vercel build command as `npm run build`; output directory is `dist`. [`vercel.json`](vercel.json) rewrites client routes to the SPA entry point.
3. In **Project → Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Preview and Production.
4. If Drive Picker is enabled, add `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, and `VITE_GOOGLE_APP_ID`. Restrict the Google API key to the deployed domain and `docs.google.com` as above.
5. Deploy. In Supabase Auth URL Configuration, set the production Site URL and allow `https://your-domain.example/web-development-competition/reset-password` (plus the local callback during development).
6. Add the exact production domain to the Google OAuth client's JavaScript origins and to the API key's Website restrictions. GIS uses a popup and therefore no OAuth redirect URL for this client.
7. Add a custom domain in Vercel if required, wait for its DNS/SSL validation, then update Supabase and Google allowed origins to that final domain.
8. Redeploy after environment changes. Test signup/login/reset, registration privacy, resource upload/download, Picker selection/cancellation, and a late submission in production. Do not call Google integration live until those tests pass with valid credentials.

## GitHub repository and Vercel deployment checks

The organizer evaluation screen includes real integration actions backed by the authenticated `competition-integrations` Supabase Edge Function. GitHub repository checks call the GitHub REST API. Public repositories can be checked without a token; private repositories need a GitHub fine-grained token with read-only **Metadata** permission. Vercel status and redeploy actions apply only to the organizer's configured Vercel project. The organizer's token cannot inspect or redeploy deployments owned by participants' personal Vercel accounts.

### Add server-side credentials and deploy the function

1. Create a Vercel access token scoped to the project/team that owns the portal deployment. It needs permission to read deployments and create deployments (redeploy).
2. Copy the Vercel project ID from project settings. For a team-owned project, also copy its team ID.
3. If judges need private GitHub repository checks, create a fine-grained token limited to relevant repositories with only **Metadata: Read-only**. Leave it unset for public repos.
4. Install the Supabase CLI, sign in, and link this folder to the project:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

5. Save provider credentials as Supabase Function secrets. Never put these tokens in `VITE_` variables or browser code:

   ```powershell
   supabase secrets set VERCEL_TOKEN=YOUR_VERCEL_TOKEN VERCEL_PROJECT_ID=YOUR_VERCEL_PROJECT_ID
   supabase secrets set VERCEL_TEAM_ID=YOUR_VERCEL_TEAM_ID
   supabase secrets set GITHUB_TOKEN=YOUR_READ_ONLY_GITHUB_TOKEN
   ```

   `VERCEL_TEAM_ID` and `GITHUB_TOKEN` are optional in the cases described above.

6. Deploy the authenticated function:

   ```powershell
   supabase functions deploy competition-integrations
   ```

7. Sign in as the promoted organizer, open **Admin → Evaluation**, select a submission, then choose **Verify GitHub repository**, **Check configured Vercel project**, or **Redeploy latest**. Redeploy asks for confirmation and starts a deployment.

The function rejects unauthenticated and non-admin callers. GitHub checks confirm repository accessibility and return basic metadata; they do not prove ownership or code quality. Vercel actions only inspect/redeploy the configured organizer project, not an arbitrary submitted URL.
## Environment variable reference

| Variable | Required for | Where obtained | Secret? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Auth, database, storage | Supabase project API settings | Public URL |
| `VITE_SUPABASE_ANON_KEY` | Browser Supabase client | Supabase API settings, anon/publishable key | Public key; protect data with RLS |
| `VITE_GOOGLE_CLIENT_ID` | Browser Google authorization | Google Auth Platform Web OAuth client | Public client ID |
| `VITE_GOOGLE_API_KEY` | Google Picker | Google Cloud API Credentials | Public key; restrict by website and Picker API |
| `VITE_GOOGLE_APP_ID` | Picker project/app identification | Google Cloud project number | Public project number |

No service-role key, Google OAuth client secret, Drive refresh token, email-provider key, or Google Sheets credential is required by the currently implemented frontend.

## Official API references

- [Google Picker web app guide](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Google Identity Services authorization for web](https://developers.google.com/identity/oauth2/web/guides/overview)
- [Supabase Storage standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
