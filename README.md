# Forma school management platform

A multi-school platform starter built with Next.js, Drizzle ORM, MySQL, and Better Auth.

## Requirements

- Node.js 20.9 or newer
- Docker Desktop with Docker Compose, or a MySQL 8+ server

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`. Set unique local values for `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and `BETTER_AUTH_SECRET`. Generate the auth secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Configure `BETTER_AUTH_URL` for the address users will open. Set `SMTP_HOST`, `SMTP_PORT`, and `EMAIL_FROM` (and SMTP credentials if required) for school invitations and password resets. Keep `.env.local` private.

   SMTP settings depend on your mail provider. Common submission ports are `587` with `SMTP_SECURE=false` (STARTTLS) or `465` with `SMTP_SECURE=true` (implicit TLS). Set both `SMTP_USER` and `SMTP_PASSWORD` when your provider requires authentication; otherwise leave both blank. Use the sender address authorized by your provider for `EMAIL_FROM`. Never put credentials in source control or share them in chat. The app's example SMTP values are placeholders and do not deliver mail.

3. Start MySQL when using the included local Docker service:

   ```bash
   docker compose --env-file .env.local up -d
   ```

   The service binds only to localhost and keeps data in the `forma_mysql_data` Docker volume.

4. Apply the committed MySQL migrations:

   ```bash
   npm run db:migrate
   ```

5. Create the first platform administrator. This command only succeeds when the configured database has no users. It asks for a password twice without echoing it to the terminal, checks the password policy, and serializes concurrent bootstrap attempts:

   ```bash
   npm run auth:create-admin -- --email admin@example.com --name "Platform Admin"
   ```

   Run it once against the intended database, after migrations and before opening the application to users. Keep platform administrator credentials under controlled access; platform admins can provision schools and manage platform-wide access. The `PLATFORM_ADMIN_PASSWORD` environment variable is also supported for controlled non-interactive provisioning and is removed from the process environment immediately after reading.

6. Start the development server:

   ```bash
   npm run dev
   ```

Open the configured `BETTER_AUTH_URL`, sign in as the platform administrator, and create a school. School administrators can then invite staff from **Team**.

### Demo schools

`npm run db:seed-demo` creates three demo schools (Abay Primary, grades 1–8; Entoto Hill Secondary, grades 9–10; Rift Valley Preparatory, grades 11–12) with a 2026/27 academic year, grades, subjects, one class per grade, and one account per school role: `admin@`, `teacher@`, `student@`, `guardian@`, `inventory@` and `hr@<slug>.forma.test`. All of them sign in with `DEMO_USER_PASSWORD` from `.env.local`, which the script generates on first run. It can be re-run safely, and it refuses to touch a non-local database unless given `--allow-remote`.

## Production deployment

Production runs Forma as its own website at `https://school.wisdomcourse.com.et` (Plesk, Node.js). The hosting server cannot compile the app, so GitHub Actions builds each push to `main` and publishes the result to the `plesk-release` branch, which Plesk deploys. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Plesk set-up, settings, and updates. `npm run deploy:plesk` builds the same release locally.

The app can also be served under a path of another site (`NEXT_PUBLIC_BASE_PATH`, or `npm run deploy:plesk -- --base-path /school`); production does not use this. `BETTER_AUTH_URL` is always the public origin without a path.

## Question imports and learning resources

Teachers and school administrators can bulk-import up to 200 single-answer multiple-choice questions per assessment in Moodle XML, GIFT, Aiken, Blackboard, or WebCT format. Moodle XML, GIFT, and Aiken files must be UTF-8 and no larger than 10 MB. Moodle XML questions with unsupported types (including essay, matching, and multi-answer questions) are skipped and reported; malformed or unsupported questions in other import formats are also reported. Other Moodle question types are not converted into multiple-choice questions.

The **Resources** page accepts PDF and office/open-document files, text, web lessons and data files, eBooks, images, animated GIF/SVG, audio, video, JSON animations, ZIP archives, and Moodle backup files up to 100 MB. Uploaded files are kept outside the public web root; uploads are restricted to school administrators and teachers, while authorized staff and active students can access their school's resources.

Uploads use private local filesystem storage. By default, files are written to `var/uploads` under the application directory; set `UPLOAD_DIR` to another absolute or application-relative path when needed. In production, mount that path on durable storage and include it in the backup and restore process. The application server and any reverse proxy must allow multipart requests of at least 101 MB for resource uploads. The included Docker Compose file only provisions MySQL; it does not run the application server or mount its upload directory.

## Textbook catalog

The **Textbooks** page shows, for every grade and subject a school teaches under the national curriculum (`src/lib/ethiopian-curriculum.ts`), the official textbooks in the platform catalog and whether the school's library already has them. Teachers and school admins add a book with one click: Forma downloads the PDF from the official source into the school's resources and links it to the grade and subject. Downloads are only made from official hosts (the Oromia Education Bureau's site and the Ministry of Education's e-learning portal; `TEXTBOOK_SOURCE_HOSTS` replaces the list), must be a PDF, and must fit the 100 MB resource limit.

`npm run db:sync-textbooks` fills the catalog: it reads the Oromia Education Bureau's textbook pages (grades 1, 3 and 5 of the new curriculum, in Afaan Oromo, Amharic and English) and adds the grade 9–12 Ministry books known so far, then checks every source with a HEAD request. Platform admins can add further sources on the Textbooks page.

`drizzle-kit` reads `.env` before `.env.local`, so `npm run db:migrate`, `db:generate` and `db:studio` use the database in `.env` when that file sets `DATABASE_URL`. Use `node scripts/migrate.mjs`, which prefers `.env.local`, for the local database.

## AI Studio

**AI Studio** has Claude read a textbook from the school's library and prepare a lesson plan, lecture notes, an assignment or an exam for the unit, lesson or pages a teacher names. Set `ANTHROPIC_API_KEY` on the server to turn it on; without it the page explains that generation is off.

- Requests use `claude-opus-5-5` (best quality) or `claude-sonnet-5-5` (about half the price), chosen per request, with refusal fallback (`fallbacks: "default"`) enabled. The answer is structured JSON validated against the schemas in `src/lib/ai-materials.ts`.
- A PDF is uploaded once through the Claude Files API; its file id is stored on the resource and reused. The textbook block is prompt-cached, so further requests on the same book within five minutes cost far less. Each result shows its token use and approximate cost.
- Generation runs after the request returns (`after()`), so proxies can't time it out; the page refreshes until the material is ready. A run cut off by a restart shows as interrupted after 15 minutes and can be retried.
- Lesson plans can be saved to **Lesson plans** as drafts, and an exam's multiple-choice part saved as a draft online quiz for a class. School admins approve material. Teachers should review all AI-written material before using it.

Textbook PDFs are sent to Anthropic for processing. Use only textbooks the school may share this way, such as the freely published official ones.

## Database and tenant access

Drizzle schema definitions are in `src/db/schema.ts`. The schema includes Better Auth identity/session tables, schools, school memberships and invitations, academic years, grade levels, classrooms, students, enrollments, subjects, teachers, lesson plans, assessments, multiple-choice questions, learning resources, assessment results, class schedules, and attendance records. The dashboard and management pages only query schools the signed-in user can access. Mutations and resource downloads recheck the current session, school membership, role, and tenant ownership; browser-supplied school IDs are never treated as authorization.

Use `npm run db:studio` to open Drizzle Studio. Do not point local development or Studio at production data.

## Authentication, roles, and deployment

Better Auth provides email/password authentication, password-reset emails, database-backed sessions, session revocation on password reset, and rate limiting. Passwords are at least 12 characters. Public account creation is blocked by an auth endpoint hook; new users can only register with an unexpired, single-use invitation matching their email address. Invitations store only a SHA-256 token hash, expire after seven days, and are delivered by SMTP. Existing accounts can also accept invitations after signing in. Student invitations require one active student profile with a matching email; accepting one links that profile to the new account.

Platform admins are created by the one-time bootstrap script and can provision school workspaces. School admins can manage their school’s team, students, academic years, grade levels, subjects, and classrooms. Teachers can read their school roster, create lesson drafts, create assessments, record class attendance, and upload learning resources; school admins review and publish submitted lessons and assessments. Published assessments support teacher-entered student scores and feedback, restricted to active students enrolled in the assessment’s class. Invited students can access published assessments for their active enrollments, submit one attempt per assessment, and receive an automatically graded multiple-choice score. Staff can review online submissions separately from staff-entered marks.

Attendance records are maintained by class and date, with present, absent, late, and excused statuses. Inventory managers and school administrators can maintain item registers and auditable receipts/issues; stock cannot be issued below zero. HR managers and school administrators can manage employee directory and employment-status records; payroll and other sensitive HR records are intentionally outside the current scope. The reports page summarizes assessment percentages and recorded attendance. Formal curriculum-outcome mastery reports require school-specific outcomes to be defined and linked to assessments.

Assessment, attendance, inventory, and HR actions enforce server-side school membership and validate school/class/item ownership. Inventory quantities are changed transactionally and each receipt/issue is preserved in movement history.

Before a production deployment, use a unique high-entropy `BETTER_AUTH_SECRET`, an HTTPS `BETTER_AUTH_URL`, a production SMTP service, protected MySQL credentials, automated backups, and a privacy/security review appropriate for student records. Apply migrations in a controlled release before deploying application code that depends on new columns or tables.

Treat the first production release as incomplete until the production mail provider has been verified and invitation and password-reset links have been exercised using a controlled test inbox. Also verify first-admin provisioning against a fresh disposable database, sign-in and session revocation, invitation expiry/reuse rejection, school-role denials, and cross-school access isolation in the deployed environment. A local SMTP capture test does not verify provider authentication, deliverability, DNS, TLS, or production URL configuration. Do not use real student information until these release checks and the required privacy/security review are complete.
