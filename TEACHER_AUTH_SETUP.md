# Smart Attendance — Teacher Auth and Cloud Data Setup

## Required environment variables

Create `.env.local` in the project root (same folder as `package.json`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the project's **publishable** key (or legacy anon key), never a `service_role` or secret key. Restart Vite after editing this file.

## Supabase Auth settings

1. In Supabase, open **Authentication → Providers → Email** and ensure Email is enabled.
2. For the first test, email confirmation may stay enabled. After signup, open the confirmation email, verify the account, and return to the app to sign in.
3. For a local-only classroom demo, confirmation can be disabled under **Authentication → Settings**. Do not disable it for a public deployment without considering account security.

## How to test

1. `npm install`
2. `npm run build`
3. `npm run dev`
4. Open the Vite local address, create a teacher account, and sign in.
5. Add a test student under Students. In Supabase Table Editor, open `public.students`; the new record should appear.
6. Mark attendance. Open `public.attendance_records`; the record should appear.
7. Refresh the app and verify students and attendance reload from Supabase.

The migration file `supabase/migrations/001_initial_schema.sql` should already have been run in the Supabase SQL Editor. Its RLS policies scope teacher-owned rows to the signed-in user.

## Scope / current limitations

Teacher email/password signup and login, class creation, student list loading, add/delete student, and manual attendance upsert/load are connected to Supabase. The current QR session/check-in flow is still browser-local and is **not** secure cross-device attendance. It must be replaced with server-side validation (e.g. a Supabase Edge Function/RPC) before being used for real attendance. Existing localStorage demo records are not automatically migrated into Supabase.
