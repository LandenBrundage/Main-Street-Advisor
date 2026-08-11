# Main Street Advisor

A responsive AI consulting workspace for small-business owners, built with Next.js, TypeScript, Tailwind CSS, Supabase, and the OpenAI Responses API.

## Local setup

Requirements: Node.js 24 LTS, npm, a Supabase project, and (for real AI/document retrieval) an OpenAI API key.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Supabase credentials are required because application data is never replaced with browser-only demo state. For automated development tests only, `ENABLE_AI_MOCKS=true` replaces the OpenAI call after real Supabase authentication; it is server-only, off by default, and ignored in production.

### Fictional customer demo

To test the full interface without signing in, while still using the real OpenAI Responses API, keep `OPENAI_API_KEY` in `.env.local` and run:

```bash
npm run dev:demo
```

Open `http://localhost:3001/demo`. This starts a localhost-only fictional customer workspace for **Sunrise Bakery & Café**, with a complete profile, goals, tasks, prior consultations, and sample business-record extracts. Real-AI messages consume OpenAI API credits. The yellow sidebar notice always states whether real or offline AI is active.

For a no-cost scripted demo, run `npm run dev:demo:offline` instead. Both demo variants are disabled in production, require no Supabase authentication, use only in-memory fictional data, and reset when their server restarts. They use `.next-demo`, so the authenticated app can continue running on port 3000.

## Supabase

1. Create a project and copy its URL and anon/publishable key to `.env.local`.
2. Install the Supabase CLI, link the project, then run `supabase db push`. If you use the SQL editor instead, run every file in `supabase/migrations` in filename order. Do not skip the goals repair, memory/profile/settings, or `202607140001_completion_workflows.sql` migration.
3. The migrations create tables, indexes, transactional functions, RLS policies, the private `business-documents` bucket, and the private `profile-avatars` bucket. RLS uses the authenticated user's `business_memberships`; server routes repeat workspace-scoped filters.
4. In Authentication → URL Configuration, add `http://localhost:3000/auth/callback` for development and the equivalent production callback.
5. In Authentication → Providers → Google, enable Google and enter the OAuth client credentials. Add Supabase's callback URL shown there to the Google Cloud OAuth client.

If an earlier SQL Editor attempt stopped with PostgreSQL error `42710`
because a policy already existed, rerun
`202607130001_memory_profile_settings.sql` from the beginning, then run
`202607140001_completion_workflows.sql`. The memory/settings migration now
replaces only its own policies and trigger when rerun; it does not delete
profiles, businesses, conversations, goals, or tasks.

Email/password sign-up may require email confirmation depending on the project's Auth settings. A newly confirmed user is sent to onboarding, where `create_initial_workspace` atomically creates their profile, business, and owner membership. For a test account, sign up through `/sign-up`; no password is stored by this application.

## OpenAI

Set `OPENAI_API_KEY` only on the server. `OPENAI_MODEL` defaults to `gpt-5.4-mini` and can be changed without editing code. The chat route uses the Responses API, strict confirmation-only action tools, bounded retrieval tools, and hosted file search when the workspace has a vector store. Spreadsheet uploads are converted to labeled visible-cell text before indexing. OpenAI and vector-store IDs are stored in protected database rows and never sent to the browser.

The memory settings in `.env.example` control how many recent messages and prior summaries are included. Complete profile, goal, task, and conversation records stay in Supabase. Every request includes only a compact business snapshot, the current incomplete primary goal, relevant open tasks, the current rolling summary, a bounded recent-message window, and at most the ten most recently completed goals and tasks combined. Older completed work remains stored in Supabase but falls out of the working context. The model can request additional workspace-scoped sections through validated server tools. Summaries preserve separate labels for confirmed facts, recommendations, actions actually tried, and confirmed results.

AI task plans still require the user to click **Add tasks**. A chat statement that a task is complete creates a separate confirmation proposal; the database task status changes only after the user approves that proposal.

## Commands

```bash
npm run dev          # development server
npm run dev:demo     # fictional customer on :3001 with real OpenAI responses
npm run dev:demo:offline # same workspace with scripted, no-cost responses
npm run lint         # ESLint
npm run typecheck    # strict TypeScript
npm test             # unit tests (OpenAI is never called)
npm run test:e2e     # Playwright critical task path; install Chromium first
npm run build        # production build
npm run check        # lint, types, unit tests, build
```

If `node --version` is below 24, run `nvm install 24 && nvm use 24` (or install Node 24 from nodejs.org) before using these commands. The repository includes `.nvmrc` so later visits only require `nvm use`.

On this development computer, the npm scripts also locate and use the installed
Node 24 runtime automatically. This means `npm run dev` and `npm run dev:demo`
still start correctly if a newly opened terminal happens to report the older
system Node version. Use Node 24 directly for `npm install` or dependency updates.

For the Playwright task test, either set `E2E_AUTH_STORAGE` to an authenticated Supabase storage-state file, or run it against the development-only workspace with `ENABLE_DEMO_MODE=true npm run test:e2e`. The test runner starts an isolated server on port 3100 using `.next-e2e`, so it does not share the normal development-server lock.

If a demo server is already running, you can avoid a second cold Next.js
compilation with
`E2E_BASE_URL=http://127.0.0.1:3001 ENABLE_DEMO_MODE=true npm run test:e2e`.

## Goals & Tasks

Goals and tasks retain their complete history in Supabase. Both sections open on **Incomplete** and provide a separate **Completed** tab. Completing or reopening a task is an explicit persisted action; reopening restores its previous incomplete status when available. Goals are never inferred complete from task progress. If an incomplete goal still has open tasks, the confirmation dialog can complete the goal alone or complete the goal and all remaining tasks atomically. Reopening a goal never reopens its tasks.

## Account settings

The authenticated Settings page can update the account name, upload a private profile picture, and set/change a password through Supabase Auth. It is reached from the account control at the bottom of the sidebar rather than the primary product navigation. The Business Profile stores business information only; it does not overwrite the account display name. Email remains read-only because no verified email-change flow is implemented. OAuth-only accounts can add a password; their existing OAuth sign-in remains available. The application never retrieves or displays an existing password.

## Security and operating notes

- Secrets remain server-only. Do not add service-role credentials to browser code or `NEXT_PUBLIC_*` variables.
- AI calls have a basic per-instance in-memory rate limit. Production deployments should replace this integration point with a shared limiter such as Upstash Redis or a gateway rule.
- Uploads are restricted by MIME type and 15 MB size in UI, server, storage bucket, and database. Paths are workspace-scoped and filenames sanitized.
- Document text and profile content are explicitly treated as untrusted data by the consultant prompt.
- Task-plan approval is a locked database transaction. A unique idempotency key and proposal state prevent duplicate execution.
- Financial profile fields are optional. The app does not log their values.

## Intentionally deferred

Team invitations, multiple workspaces per account UI, billing, notifications, calendar sync, board view, live Google Sheets sync, and background job infrastructure are outside this MVP. Document processing currently occurs inline; move it to a durable queue before serving high upload volume. Streaming UI is also deferred in favor of reliable persisted responses and retry behavior.
