# Indoplatform Panel

> Self-hosted server monitoring & control panel untuk VPS Anda.
> Next.js 14 + Prisma + NextAuth + Recharts + systeminformation.

**Demo:** [panel.indoplatform.id](https://panel.indoplatform.id)
**Mirror:** [github.com/indoplatform/panel](https://github.com/indoplatform/panel)

![Indoplatform Panel](https://indoplatform.id/imgs/panel-preview.png)

---

## ✨ Fitur

- 🖥️ **VPS Metrics real-time** — CPU, RAM, disk, network, load average
- 🔄 **Service manager** — start / stop / restart systemd service via SSH
- 📜 **Log viewer** — tail `journalctl` & `nginx access.log` via SSE stream
- 🌐 **Cloudflare DNS manager** — list, add, delete A record (pakai CF API token)
- 📈 **Uptime monitor** — HTTP HEAD check untuk URL publik Anda (multi-target)
- 🔐 **Audit log** — siapa ngapain, kapan, dari IP mana
- 🚨 **Alert opsional** — Telegram / Brevo email kalau CPU/RAM/disk tinggi atau service down
- 🎨 **Theme "Heritage Premium"** — Navy + Gold, konsisten dengan rental.indoplatform.id

---

## 🚀 Quick start

### Prasyarat
- Node.js 20+
- PostgreSQL 14+
- (Opsional) systemd di Linux + SSH key

### 1. Install dependencies
```bash
cd apps/Panel
pnpm install
```

### 2. Setup database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE panel;"

# Copy env
cp .env.example .env
# Edit .env — minimal: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```

### 3. Migrate + seed
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
**Akun default:** `admin@panel.local` / `admin123` (ganti setelah login pertama!)

### 4. Run dev
```bash
pnpm dev
# → http://localhost:3003
```

### 5. Production build
```bash
pnpm build
pnpm start
```

---

## ⚙️ Environment variables

Lihat `.env.example` untuk dokumentasi lengkap.

**Wajib:**
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — random 32-byte (generate: `openssl rand -base64 32`)
- `NEXTAUTH_URL` — URL publik panel Anda

**Opsional (per fitur):**
- `CLOUDFLARE_*` — DNS manager
- `BREVO_*` — email alert
- `TELEGRAM_*` — Telegram alert
- `SSH_*` — jika Panel monitor VPS remote (bukan localhost)

---

## 🔒 Security checklist (WAJIB untuk production)

- [ ] Ganti password default admin setelah login pertama
- [ ] Enable 2FA (planned V1.1 — pakai authenticator app)
- [ ] Set IP whitelist jika Panel di belakang VPN
- [ ] Setup SSH key pair khusus untuk Panel (JANGAN pakai root key pribadi)
- [ ] Setup sudoers terbatas jika Panel monitor localhost:
  ```bash
  # /etc/sudoers.d/panel
  paneluser ALL=(ALL) NOPASSWD: /usr/bin/systemctl start *, /usr/bin/systemctl stop *, /usr/bin/systemctl restart *, /usr/bin/journalctl *
  ```
- [ ] Reverse proxy (nginx/Caddy) + HTTPS (Let's Encrypt / Cloudflare)
- [ ] Set firewall: hanya port 80/443 publik, 3003 internal
- [ ] Audit log retention: minimal 90 hari (config via `AUDIT_RETENTION_DAYS`)

---

## 📦 Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript strict |
| Auth | NextAuth v5 beta (Credentials + JWT) |
| ORM | Prisma 5.22 + PostgreSQL 14+ |
| UI | Tailwind 3 + Radix UI + lucide-react + framer-motion |
| Chart | Recharts (lazy require) |
| System | systeminformation 5.x (CPU/RAM/disk/network/process) |
| Remote SSH | child_process + ssh-key-based auth |
| Email | Brevo SMTP (opsional) |

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│  Browser User (auth: NextAuth JWT)                          │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js App (port 3003)                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │Dashboard │ │ Services │ │   Logs   │ │ DNS / Audit  │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘    │
│       │            │            │              │            │
│  ┌────▼────────────▼────────────▼──────────────▼───────┐    │
│  │  Service Layer (lib/system, lib/cloudflare, etc)    │    │
│  └────┬────────────┬────────────┬───────────────────────┘    │
└───────┼────────────┼────────────┼────────────────────────────┘
        ▼            ▼            ▼
   systemctl     journalctl    Cloudflare API
   (via SSH or   (local or     (HTTPS)
    local exec)   SSH)
```

---

## 🌍 Deployment (Ubuntu 24.04 systemd + nginx)

```bash
# 1. Build lokal
pnpm build

# 2. Tar + upload
tar -czf /tmp/panel.tar.gz --exclude=node_modules --exclude=.next .
scp /tmp/panel.tar.gz user@your-vps:/tmp/

# 3. Di VPS: extract + install
ssh user@your-vps
sudo mkdir -p /opt/panel
sudo chown $USER:$USER /opt/panel
cd /opt/panel
tar -xzf /tmp/panel.tar.gz
pnpm install --prod
pnpm db:generate

# 4. Setup systemd
sudo tee /etc/systemd/system/panel.service <<EOF
[Unit]
Description=Indoplatform Panel
After=network.target postgresql.service

[Service]
Type=simple
User=panel
WorkingDirectory=/opt/panel
Environment=NODE_ENV=production
Environment=PORT=3003
EnvironmentFile=/opt/panel/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3003 -H 127.0.0.1
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now panel

# 5. Setup cron untuk metrics + uptime
crontab -e
# Tambah:
# */1 * * * * cd /opt/panel && /usr/bin/node scripts/cron-runner.js metrics
# */1 * * * * cd /opt/panel && /usr/bin/node scripts/cron-runner.js uptime
```

---

## 🛣️ Roadmap

Lihat [ROADMAP.md](./ROADMAP.md).

- [x] V1.0 — Dashboard + service manager + log viewer + DNS manager + audit log
- [ ] V1.1 — 2FA (TOTP), alert rules UI, deploy trigger per-app
- [ ] V1.2 — Multi-server (panel monitor banyak VPS sekaligus)
- [ ] V2.0 — SaaS multi-tenant (jual ke klien)

---

## 📄 Lisensi

MIT — bebas digunakan, dimodifikasi, dan didistribusikan.
Attribusi appreciated: "Indoplatform Panel by CreatorB"

---

## 🙏 Kredit

- [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- [Recharts](https://recharts.org/)
- [shadcn/ui](https://ui.shadcn.com/) (inspirasi)
- [Next.js](https://nextjs.org/)
