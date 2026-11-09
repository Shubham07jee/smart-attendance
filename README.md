# Smart Attendance — Teacher Edition

A professional, minimal attendance management starter for individual teachers.

## Included in this ZIP

- Responsive teacher dashboard
- Demo/local mode (works without Supabase)
- Add/remove students and search roster
- Manual attendance: Present, Absent, Late, Excused
- QR session generator (QR points to a session link)
- QR session page where a student can submit name + roll number
- Excel workbook export (`.xlsx`)
- Supabase-ready schema and Row Level Security policies
- Git-friendly project layout

> **Important:** Local/demo mode saves data in this browser only. It is not shared between devices. To enable cloud persistence and real teacher accounts, follow the Supabase setup below. QR attendance in this starter is a functional prototype; before real-world use, configure Supabase-backed session validation and student identity verification. A QR code by itself does not prove a student's physical presence.

## Requirements

Install:
- Node.js LTS (20 or newer recommended)
- npm (comes with Node.js)
- Git (optional, for Git commits)

## Start on Ubuntu (beginner steps)

1. Download and extract the ZIP.
2. Open the extracted `SmartAttendancePro` folder.
3. Right-click inside the folder and choose **Open in Terminal**.
4. Check Node/npm:
   ```bash
   node -v
   npm -v
   ```
5. If those commands show version numbers, install dependencies:
   ```bash
   npm install
   ```
6. Start the app:
   ```bash
   npm run dev
   ```
7. Open the URL shown in terminal, usually `http://localhost:5173`.
8. Stop the app with **Ctrl + C** in that terminal.

## Supabase cloud setup

1. Create a project at https://supabase.com/
2. In Supabase, open **SQL Editor**.
3. Copy/paste `supabase/migrations/001_initial_schema.sql` and click **Run**.
4. In Supabase, open **Project Settings → API** (or API Keys).
5. Copy the **Project URL** and the **anon/public key**. Never copy the `service_role` / secret key into a frontend.
6. In this project folder, duplicate `.env.example` and name the copy `.env`.
7. Put the URL and anon/public key into `.env`.
8. Restart Vite (`Ctrl+C`, then `npm run dev`).

The starter uses Supabase client initialization when environment values exist. The SQL defines teacher-owned records and policies. Check/test the policies in Supabase before storing real student data.

## Excel

Click **Export Excel** in the app. The workbook includes a roster sheet and attendance sheet. Export is generated in your browser.

## QR flow

1. Choose **QR Session** from the sidebar.
2. Create a session for the selected class.
3. Show the QR to students.
4. Students open the QR URL and enter their name/roll number.
5. Teacher can review/mark attendance in the dashboard.

The demo QR URL is based on the current app origin and uses a local session ID. The QR check-in is a prototype in local mode; production use needs authenticated/server-side session expiry, anti-replay protections, and verified student identity.

## Git: make many commits (save points)

A commit is like a named save point. Commit often, after a small working milestone.

### First save

```bash
git init
git add .
git commit -m "Initial Smart Attendance project"
```

### Save more progress

```bash
git status
git add .
git commit -m "Add student management"
```

Use clear messages, for example:
- `Add attendance dashboard`
- `Add QR session screen`
- `Add Excel export`
- `Fix attendance status update`
- `Improve mobile layout`

### Connect to your GitHub repository

If you already have a repository, copy its SSH URL from GitHub (it looks like `git@github.com:USERNAME/REPOSITORY.git`), then:

```bash
git branch -M main
git remote add origin git@github.com:USERNAME/REPOSITORY.git
git push -u origin main
```

If `origin` already exists, don't run `remote add` again. Check it with:
```bash
git remote -v
```

Then future saves:
```bash
git add .
git commit -m "Describe what changed"
git push
```

### Keep your original GitHub project safe

This ZIP does **not** overwrite your GitHub repo. First extract and test it locally. If you want to replace the existing repository later, make a backup or create a new branch first.

## Production checklist before real use

- Set up Supabase Auth (teacher sign-in)
- Wire database CRUD in the app (current UI demo data is browser-local)
- Test RLS with two different teacher accounts
- Configure QR session expiry and server-side token validation
- Confirm identity verification rules
- Add backups and privacy/retention policy
- Test Excel report accuracy
- Test on Android before building APK
