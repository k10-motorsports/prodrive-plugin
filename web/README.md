# K10 Motorsports — Web

Part of the [K10 Motorsports](https://github.com/alternatekev/media-coach-simhub-plugin) sim racing platform. Next.js 16 site for [k10motorsports.racing](https://k10motorsports.racing) with subdomain routing:

- **k10motorsports.racing** — Marketing site (public): product overview, feature highlights, download links, and documentation for the broadcast-grade sim racing HUD
- **prodrive.racecor.io** — K10 Pro Drive members app (Discord auth): exclusive content, setup guides, and community features

Stack: Next.js 16, React 19, Tailwind CSS 4, NextAuth 5, Strapi CMS.

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Strapi instance running (see [CMS Setup](#cms-setup) below)

### 1. Install dependencies

```bash
cd web
npm install
```

### 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key ([Google Cloud Console](https://console.cloud.google.com/apis/credentials)) |
| `DISCORD_CLIENT_ID` | For auth | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | For auth | Discord OAuth app secret |
| `NEXTAUTH_SECRET` | For auth | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` locally, `https://prodrive.racecor.io` in production |
| `STRAPI_URL` | For CMS | Strapi instance URL (e.g. `http://localhost:1337`) |
| `STRAPI_API_TOKEN` | For CMS | Strapi API token (Settings → API Tokens → Create) |

### 3. Local domain setup

The middleware uses subdomain routing. Dev domains use a `dev.` prefix so they never collide with production DNS. Add these to `/etc/hosts`:

```
127.0.0.1   dev.k10motorsports.racing
127.0.0.1   dev.prodrive.racecor.io
```

Then access:

- `http://dev.k10motorsports.racing:3000` → marketing site
- `http://dev.prodrive.racecor.io:3000` → drive members app

Alternatively, use the query parameter shortcut without hosts changes:

- `http://localhost:3000` → marketing site
- `http://localhost:3000?subdomain=drive` → drive members app

> **Note:** `SITE_URL` and `DRIVE_URL` in `constants.ts` auto-switch between `http://dev.` (dev) and `https://` (production) based on `NODE_ENV`.

### 4. Start the dev server

```bash
npm run dev
```

> **Note:** The dev server uses `--webpack` instead of Turbopack due to a LightningCSS native module compatibility issue with Turbopack in Next.js 16. This is configured in `package.json` and requires no extra steps.

---

## CMS Setup (Strapi)

Strapi provides the headless CMS for managing site content (news posts, driver profiles, team info, etc.).

### Option A: Local Strapi (development)

```bash
# From the repo root (outside web/)
npx create-strapi-app@latest cms --quickstart
```

This creates a `cms/` directory with SQLite. Once running:

1. Open `http://localhost:1337/admin` and create your admin account
2. Go to **Settings → API Tokens → Create new API Token**
   - Name: `k10-web`
   - Type: `Read-only` (or Full access if the site will write data)
   - Copy the token
3. Add to `web/.env.local`:
   ```
   STRAPI_URL=http://localhost:1337
   STRAPI_API_TOKEN=your-token-here
   ```

### Option B: Strapi Cloud (production)

1. Push your Strapi project to GitHub
2. Sign up at [cloud.strapi.io](https://cloud.strapi.io)
3. Connect your repo and deploy
4. Create an API token in the Strapi Cloud admin panel
5. Set the environment variables in Vercel (see below)

### Option C: Self-hosted Strapi

Deploy Strapi to any Node.js host (Railway, Render, DigitalOcean App Platform):

```bash
cd cms
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

Use PostgreSQL in production — configure via Strapi's `config/database.ts`:

```ts
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME'),
      user: env('DATABASE_USERNAME'),
      password: env('DATABASE_PASSWORD'),
    },
  },
});
```

---

## Deploy to Vercel

### 1. Connect repository

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Set the **Root Directory** to `web`
5. Framework preset will auto-detect **Next.js**

### 2. Environment variables

In Vercel project settings → Environment Variables, add:

```
YOUTUBE_API_KEY=your-key
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://prodrive.racecor.io
DISCORD_CLIENT_ID=your-id
DISCORD_CLIENT_SECRET=your-secret
STRAPI_URL=https://your-strapi-instance.com
STRAPI_API_TOKEN=your-token
```

### 3. Domain configuration

In Vercel project settings → Domains, add both:

| Domain | Purpose |
|---|---|
| `k10motorsports.racing` | Marketing site |
| `prodrive.racecor.io` | Pro Drive members app |

Then configure DNS at your registrar:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `prodrive` | `cname.vercel-dns.com` |

> Vercel automatically provisions SSL certificates for both domains.

### 4. Discord OAuth callback

Update your Discord application's OAuth2 redirect URL to:

```
https://k10motorsports.racing/api/auth/callback/discord
https://prodrive.racecor.io/api/auth/callback/discord
```

### 5. Deploy

Vercel deploys automatically on every push to `main`. To trigger manually:

```bash
npx vercel --prod
```

---

## Build

```bash
npm run build    # Production build (uses Webpack)
npm start        # Serve the production build locally
```

---

## Project Structure

```
web/
├── public/branding/       # Logomark assets (logomark.png, logomark-white.png)
├── src/
│   ├── app/
│   │   ├── marketing/     # k10motorsports.racing routes
│   │   ├── drive/         # prodrive.racecor.io routes
│   │   └── api/           # API routes (ratings, auth)
│   ├── components/        # Shared React components
│   ├── lib/               # Constants, YouTube API, utilities
│   ├── middleware.ts       # Subdomain routing
│   └── styles/globals.css # Design tokens (K10 brand palette)
├── .env.example           # Environment variable template
├── next.config.ts         # Next.js config
└── package.json
```
