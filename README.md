# Fidelity Up

SaaS Wallet loyalty platform for local merchants — by 14 Level Up

**Live** → https://fidelity-up.vercel.app  
**Repo** → https://github.com/massimotfbuisness-del/fidelity-up

---

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (PostgreSQL + RLS multi-tenant) — project: `zrbxgryrgpajqwciuozy` (eu-west-3)
- AddToWallet.co API (Apple Wallet + Google Wallet)
- `qrcode.react` — QR generation / `jsqr` — QR camera scanning
- Vercel — deployment

---

## Env vars required

Create `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=https://zrbxgryrgpajqwciuozy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ADDTOWALLET_API_KEY=...
NEXT_PUBLIC_APP_URL=https://fidelity-up.vercel.app
```

Same vars must be set in Vercel project settings.

---

## Dev setup

```bash
git clone https://github.com/massimotfbuisness-del/fidelity-up
cd fidelity-up
npm install
# create .env.local with vars above
npm run dev
```

---

## Current routes

| Route | Role | Auth |
|---|---|---|
| `/login` | Login / signup | Public |
| `/merchants` | Commerce selector (agent view) | Auth |
| `/setup` | Create new commerce | Auth |
| `/board` | Loyalty board (clients, visits) | Auth |
| `/board/passes` | Manage Wallet cards | Auth |
| `/board/settings` | Commerce settings | Auth |
| `/install/[passId]` | Client install page | Public |

---

## DB schema (current)

```sql
tenants  (id, owner_id, name, type, primary_color, phone, address, logo_url)
passes   (id, tenant_id, type, name, reward_threshold, reward_description, addtowallet_pass_id, install_url, qr_url)
clients  (id, tenant_id, phone, name, visits_count, last_visit, wallet_pass_id)
visits   (id, client_id, tenant_id, created_at)
```

---

## What is built

- Multi-tenant auth (Supabase RLS)
- Commerce creation in < 30s
- 4 wallet card types (loyalty, business card, gift, coupon)
- AddToWallet API integration → QR install
- Loyalty board: Active / Dormant (+21d) / Rewards sections
- Visit recording: manual phone input OR camera QR scan
- Client personal QR on `/install` success screen
- Commerce selector (agent managing multiple merchants)

---

## What to build next

### Priority 1 — Terrain-ready

- [ ] Roles: `super_admin` / `owner` / `manager` / `staff` + `tenant_members` table
- [ ] `/install/[passId]` premium mobile landing (logo, email field, strong CTA)
- [ ] Merchant dashboard: QR install as first screen, large scan button
- [ ] Super admin cockpit: all merchants, global stats, quick access

### Priority 2 — Scalable architecture

- [ ] `events` table (audit trail + automation base)
- [ ] `tenant_modules` table (feature flags per commerce)
- [ ] `tenant_profile` table (CRM upsell data)
- [ ] REST API: `/api/tenants`, `/api/clients`, `/api/visits`, `/api/events`
- [ ] `wallet_provider` field in `passes` table (abstraction layer)

### Priority 3 — Polish

- [ ] PWA (manifest.json + service worker)
- [ ] Better QR scanner UI (visual feedback, error handling)
- [ ] Toast system (react-hot-toast)
- [ ] Skeleton loading states
- [ ] Logo upload for commerce

---

## Tables to add

```sql
tenant_members (
  tenant_id uuid references tenants,
  user_id   uuid references auth.users,
  role      text  -- 'super_admin' | 'owner' | 'manager' | 'staff'
)

events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants,
  type        text,  -- 'client_created' | 'pass_installed' | 'visit_recorded' | 'reward_unlocked'
  entity_type text,
  entity_id   uuid,
  payload     jsonb,
  created_at  timestamptz default now()
)

tenant_modules (
  tenant_id uuid references tenants,
  module    text,  -- 'loyalty' | 'giftcard' | 'wallet_card' | 'reservation' | 'ordering' | 'whatsapp' | 'crm' | 'voice_agent'
  enabled   boolean default false,
  config    jsonb
)

tenant_profile (
  tenant_id        uuid references tenants,
  has_ubereats     boolean,
  has_whatsapp     boolean,
  has_reservation  boolean,
  website_url      text,
  staff_size       int,
  daily_customers  int
)
```

---

## Future modules (architecture-ready)

- KitchenUp (kitchen display system)
- Reservation
- WhatsApp ordering
- Voice AI agent
- CRM automation
- Analytics

---

*Built by 14 Level Up x Claude Code*
