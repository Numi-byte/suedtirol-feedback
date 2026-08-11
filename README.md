# Südtirol Feedback

Two independent Next.js applications backed by the same hosted Supabase Cloud project:

- `client/` — public feedback application on port 3000
- `protected/` — internal administration portal on port 3001
- `supabase/` — versioned database assets (migrations are planned for Phase 2)

## Requirements

- Node.js 20 or newer
- npm
- A hosted Supabase project (no local Supabase runtime is required)

## Setup

Install dependencies from the repository root:

```bash
npm install
npm install --prefix client
npm install --prefix protected
```

Copy `.env.local.example` to `.env.local` in **both** application directories and fill in the values from the hosted project's API settings:

```bash
cp client/.env.local.example client/.env.local
cp protected/.env.local.example protected/.env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is intended for application clients. Never add a database password or service-role key to either application.

Next.js reads each application's environment file when its development server starts. If either file is added or changed while `npm run dev` is running, restart the development server. The protected portal displays a setup prompt instead of failing when its Supabase configuration is absent.

When the protected development server is started without a `.env.local` file, its `predev` step copies `.env.local.example` automatically. The copy is never overwritten, so existing local credentials remain untouched. Review the generated file and restart the server after changing its values.

## Development

Start both applications together:

```bash
npm run dev
```

Or start them independently with `npm run dev:client` and `npm run dev:protected`.

| Application | URL |
| --- | --- |
| Public client | http://localhost:3000 |
| Protected portal | http://localhost:3001 |

## Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` from the repository root.
