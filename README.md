# Construction CRM

Operations CRM for a construction company: leads, customers, quotes (options A–E, PDF, email to client), invoices and payments, projects and scheduling, crew hours, subcontractor and crew payroll, rep commissions, overhead, job costing and insights.

- **Hosting:** Vercel (static page + 4 small serverless functions in `api/`)
- **Database and logins:** Supabase (Postgres with row-level security, email/password auth, live updates)
- **Client email:** Resend
- **AI quote drafter and assistant (optional):** Claude API

## Set it up (about 20 minutes)

### 1. Supabase (database and logins)
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key. Keep the service_role key secret.

### 2. Resend (emails to clients)
1. Create a free account at [resend.com](https://resend.com) → **API Keys → Create** and copy the key.
2. Once you own your domain: **Domains → Add domain** and add the DNS records it shows at your registrar. Until a domain is verified, Resend only delivers to your own Resend login email, so client emails won't arrive yet.

### 3. Vercel (hosting)
1. At [vercel.com](https://vercel.com): **Add New → Project → Import** `construction-crm`. Framework preset: **Other**. Leave the build settings empty.
2. Add these **Environment Variables**, then **Deploy**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender address on your verified domain, e.g. `quotes@yourcompany.com` |
| `ANTHROPIC_API_KEY` | Optional: turns on the AI quote drafter and assistant ([console.anthropic.com](https://console.anthropic.com)) |
| `ANTHROPIC_MODEL` | Optional: defaults to `claude-opus-5-5` |

After changing a variable later, redeploy (**Deployments → ⋯ → Redeploy**).

### 4. First login
1. In Supabase → **Authentication → URL Configuration**: set **Site URL** to your Vercel address (e.g. `https://construction-crm.vercel.app`) and add `https://construction-crm.vercel.app/**` under **Redirect URLs**.
2. Open the site. The first visit shows **Create the owner account**. Confirm the email Supabase sends, then sign in.
3. In Supabase → **Authentication → Sign In / Providers → Email**, turn off **Allow new users to sign up**, so people join only by invite.
4. In the CRM: **Company Settings** (name, logo, tax, services), then **Team → Login users → Invite user** for each person.

### 5. Your own domain
1. Buy the domain (Namecheap, GoDaddy, Cloudflare…).
2. Vercel → your project → **Settings → Domains → Add** (e.g. `crm.yourcompany.com`) and create the DNS record Vercel shows at your registrar.
3. Update Supabase **Site URL** and **Redirect URLs** to the new domain, and verify the domain in Resend (step 2.2), then set `EMAIL_FROM` to an address on it.

### 6. Reliable login emails (recommended)
Supabase's built-in mailer sends only a few emails per hour. For invites and password resets, use Resend: Supabase → **Authentication → Emails → SMTP Settings** → host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender = an address on your verified domain.

## Roles

| Role | Can do |
|---|---|
| Owner / Admin | Everything, including company settings, team, overhead and payroll payments. Only an Owner can create or change Owners, and there is always at least one active Owner. |
| Sales rep | Leads, customers, quotes, invoices, follow-ups |
| Crew lead / Crew | Projects, schedule, hours, expenses, their own pay |
| No access yet | New sign-ups wait here until an Owner/Admin gives them a role |

The database enforces access: only active staff can read records, and settings, team, overhead and payroll payments need Owner/Admin. Menus are tailored per role in the app.

## Working on the code

- The page is assembled from `src/` into `public/index.html` by `./build.sh`. Commit the built file; Vercel serves `public/` as is.
- `api/` holds the serverless functions: `config` (public settings), `send-email` (Resend), `invite` (team invites), `ai` (Claude proxy). Each checks the caller's login and role.
- `npm install && npm test` runs the server tests.
- All records live in one `docs` table (`collection`, `id`, JSON `data`); `supabase/schema.sql` holds the tables, access rules and triggers and is safe to run again.
