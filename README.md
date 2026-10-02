# ImageLink Generator

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade, full-stack **Image Link Generator** system. It transforms static images (JPG, JPEG, PNG up to 10MB) into shareable short links (`/i/:shortId`) with server-rendered Open Graph & Twitter Cards metadata for social media crawlers, and **immediate HTTP 302/307 redirects** (zero artificial delay) for human visitors.

Includes a complete **Web Creator**, **Social Crawler & OG Debugger**, **Dashboard Analytics**, **Telegram Bot**, **Telegram Mini App**, **Telegram Chat Simulator**, and an **Admin Moderation Console**.

---

## 🌟 Key Features

1. **Dual-Mode `/i/:shortId` Endpoint**:
   - **Social Crawlers** (`facebookexternalhit`, `Twitterbot`, `Discordbot`, `TelegramBot`, `WhatsApp`, `LinkedInBot`, `Slackbot`, `Googlebot`, etc.): Receives **HTTP 200** with server-rendered HTML containing complete Open Graph and Twitter Card tags.
   - **Human Visitors**: Receives an **instant HTTP 302 Found** directly to the target destination. Zero delay, zero countdown, zero interstitial screens, and zero JavaScript redirect timers.

2. **Image Processing Pipeline**:
   - High-performance image processing using `sharp`.
   - **Crop 16:9** (1200×630 pixels social card standard with entropy focal centering).
   - **Full Image** (1200×630 pixels letterboxed canvas preserving the original aspect ratio without distortion).
   - Instant live visual card preview updating on option toggle.

3. **Telegram Bot & Mini App Integration**:
   - Full Telegram Bot API integration supporting `/start`, `/help`, `/new`, `/links`, `/stats`, and `/cancel`.
   - Multi-step conversational upload workflow with persistent sessions across restarts.
   - Interactive in-browser **Telegram Chat Simulator** for testing without needing a bot token.
   - Built-in one-click Telegram Webhook registration tool.

4. **Security & SSRF Hardening**:
   - URL validation restricting schemes strictly to `http://` and `https://`.
   - Blocks dangerous pseudo-protocols (`javascript:`, `data:`, `file:`, `vbscript:`, `about:`, `chrome:`).
   - Comprehensive SSRF filter blocking loopback (`127.0.0.1`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata (`169.254.0.0/16`), and internal TLDs (`.local`, `.internal`, `.lan`).
   - Sliding-window in-memory rate limiting on upload and link creation routes.

5. **Persistent Storage & Database**:
   - Embedded SQLite database in Write-Ahead Logging (`WAL`) mode for fast concurrent reads and writes.
   - Separate indexed tables for `ImageLinks`, `ClickEvents`, and `bot_sessions`.
   - Persistent image object storage in `./data/uploads/`.
   - Fail-safe non-blocking click tracking: analytics errors never delay or block the redirect.

6. **Automated Verification Test Suite**:
   - Built-in automated behavior test runner verifying zero redirect delay, crawler OG rendering, disabled link handling, 404 responses, and analytics resilience.

---

## 📂 Project Architecture

```
├── server.ts                 # Main Express server: handles /i/:shortId & Vite SPA middleware
├── server/
│   ├── db.ts                 # Persistent SQLite database service & schema
│   ├── storage.ts            # Sharp image processing & local object storage service
│   ├── bot.ts                # Telegram Bot API client, command handlers, and SSRF validator
│   ├── routes.ts             # REST API router (/api/image-links, /api/crawler-test, etc.)
│   ├── rateLimiter.ts        # Sliding-window rate limiting middleware
│   └── urlHelper.ts          # Base URL resolver across Cloud Run, reverse proxies, and ports
├── src/
│   ├── components/
│   │   ├── Navbar.tsx        # Top navigation (Creator, Dashboard, Crawler, Telegram, Admin)
│   │   ├── CreatorView.tsx   # 6-step Creator interface with real-time 16:9 preview
│   │   ├── DashboardView.tsx # Link management, click counts, status toggles, deletion
│   │   ├── CrawlerTestView.tsx # Social crawler inspector & automated test runner
│   │   ├── TelegramSimulatorView.tsx # Interactive Telegram chat mock testing the live backend
│   │   ├── AdminView.tsx     # Protected moderation console via ADMIN_SECRET
│   │   └── SetupModal.tsx    # Telegram Bot token guide & one-click webhook setup
│   ├── types.ts              # Shared TypeScript definitions
│   ├── App.tsx               # Main frontend state controller
│   ├── main.tsx              # React 19 entry point
│   └── index.css             # Tailwind v4 styles
├── scripts/
│   └── run-tests.ts          # Automated behavior verification script (npm run test:behavior)
├── data/
│   ├── .gitkeep              # Directory placeholder (persists SQLite database)
│   └── uploads/
│       └── .gitkeep          # Directory placeholder (persists uploaded & processed images)
├── Dockerfile                # Multi-stage production container build
├── .dockerignore             # Docker build ignore rules
├── .env.example              # Environment variables template
├── package.json              # Project scripts & dependencies
└── tsconfig.json             # TypeScript compiler configuration
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` before running:

```bash
cp .env.example .env
```

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | Set to `production` in production environments | `production` |
| `PORT` | Optional | Port for the Express web server (default: `3000`) | `3000` |
| `PUBLIC_BASE_URL` | **Recommended** | Canonical HTTPS URL used for generated short links and OG tags | `https://links.yourdomain.com` |
| `APP_URL` | Optional | Fallback host URL if different from `PUBLIC_BASE_URL` | `https://app.run.app` |
| `TELEGRAM_BOT_TOKEN` | Optional | Token from `@BotFather` to enable live Telegram integration | `7123456789:AAH...` |
| `ADMIN_SECRET` | **Recommended** | Secret passphrase to unlock the Admin moderation panel | `super_secure_admin_pass` |

*Note: If `TELEGRAM_BOT_TOKEN` is not provided, the web application and built-in Telegram Simulator remain fully functional.*

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ or 22+
- npm or bun

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/imagelink-generator.git
cd imagelink-generator

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### 3. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🧪 Automated Behavior Testing

The project includes an automated test suite verifying the 5 critical behavioral requirements:
1. **Normal Browser Request**: Immediate HTTP 302/307 redirect to destination with zero delay.
2. **Social Crawler Request**: HTTP 200 with server-rendered Open Graph and Twitter Card tags.
3. **Disabled Link**: HTTP 403 blocking navigation (never redirects).
4. **Unknown Link**: HTTP 404 response.
5. **Analytics Resilience**: Database write failures never block the redirect.

Run the tests via CLI:
```bash
npm run test:behavior
```

Or run them directly within the web app by navigating to **Crawler Debugger** -> click **"Run All 5 Behavior Tests"**.

---

## 🐳 Deployment Guides

### Option A: Docker Deployment

The included multi-stage `Dockerfile` packages the app with `sharp` native bindings and optimizations.

```bash
# Build the Docker image
docker build -t imagelink-generator .

# Run the container with persistent storage mounted
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e PUBLIC_BASE_URL="https://links.yourdomain.com" \
  -e ADMIN_SECRET="your_strong_admin_secret" \
  -e TELEGRAM_BOT_TOKEN="your_bot_token" \
  --name imagelink \
  --restart unless-stopped \
  imagelink-generator
```

---

### Option B: Google Cloud Run

1. Build and push the container image to Google Artifact Registry:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/imagelink-generator
```

2. Deploy the service:
```bash
gcloud run deploy imagelink-generator \
  --image gcr.io/YOUR_PROJECT_ID/imagelink-generator \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ADMIN_SECRET="your_secret"
```

3. Set `PUBLIC_BASE_URL` to your Cloud Run assigned service URL or custom domain.

---

### Option C: VPS (Ubuntu / Debian with PM2 & Nginx)

1. **Build the production bundle**:
```bash
npm run build
```

2. **Start with PM2**:
```bash
npm install -g pm2
pm2 start server.ts --name imagelink --interpreter ./node_modules/.bin/tsx
pm2 save
pm2 startup
```

3. **Configure Nginx as a reverse proxy**:
```nginx
server {
    server_name links.yourdomain.com;

    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable HTTPS with Let's Encrypt:
```bash
sudo certbot --nginx -d links.yourdomain.com
```

---

## 🤖 Telegram Bot & Webhook Setup

1. Open Telegram and search for [`@BotFather`](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a display name and username (e.g. `MyImageLink_bot`).
3. Copy the **HTTP API Token** provided by BotFather.
4. Set `TELEGRAM_BOT_TOKEN` in your `.env` or deployment environment.
5. In the web application:
   - Click the **Telegram Webhook** button in the header or footer.
   - Click **"Auto-Register Webhook with Telegram"** to automatically bind `https://YOUR_DOMAIN/api/telegram/webhook`.
6. Start a chat with your bot in Telegram and send `/start` or `/new` to create image links!

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /i/:shortId` | `GET` | Public Link: Returns OG HTML for crawlers or immediate HTTP 302 redirect for humans |
| `POST /api/image-links` | `POST` | Creates a new ImageLink (multipart/form-data: `image`, `destinationUrl`, `description`, `framingMode`) |
| `GET /api/image-links` | `GET` | Lists recent ImageLinks with pagination and click counts |
| `GET /api/image-links/:shortId` | `GET` | Retrieves metadata and public URL for a specific link |
| `PATCH /api/image-links/:id/status`| `PATCH` | Updates link status (`active` or `disabled`) |
| `DELETE /api/image-links/:id` | `DELETE` | Permanently removes an ImageLink and its files |
| `GET /api/crawler-test` | `GET` | Simulates crawler extraction and returns parsed OG tags & raw HTML |
| `POST /api/run-tests` | `POST` | Executes the 5 automated behavior verification tests |
| `POST /api/telegram/webhook` | `POST` | Telegram Bot API webhook updates endpoint |
| `POST /api/telegram/simulate`| `POST` | Simulator endpoint executing Telegram bot updates |
| `GET /api/health` | `GET` | Service health status and uptime |

---

## 🛡️ Security Best Practices

- **Zero Secret Exposure**: Secret tokens (`TELEGRAM_BOT_TOKEN`, `ADMIN_SECRET`) exist exclusively in server-side memory and are never sent to client JavaScript.
- **SSRF Immunity**: The destination URL validator resolves hostnames, checks IP ranges, and rejects loopback, RFC 1918 private subnets, and cloud instance metadata addresses (`169.254.169.254`).
- **Input Sanitization**: HTML entities in descriptions and titles are escaped before insertion into server-rendered `<meta>` tags to prevent Cross-Site Scripting (XSS).
- **Persistent Immutability**: Destination URLs are locked upon creation to prevent redirect hijacking.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
