# Mindalike 💙

An Omegle-style random chat matching app for World App. Connect with real, verified humans instantly.

**Live at:** https://world.mind-alike.com

---

## 🚀 Quick Deploy to Cloudflare Workers

```bash
# Install dependencies
npm install

# Build and deploy
npm run deploy
```

---

## 📁 Project Structure

```
World/
├── app/                    # Next.js pages
│   ├── globals.css        # Tailwind + custom styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   └── providers.tsx      # MiniKit provider
├── components/
│   ├── MindalikeApp.tsx   # Main app component
│   └── ui/                # Reusable UI components
├── lib/
│   ├── constants.ts       # App constants
│   └── hooks/             # Custom React hooks
├── worker/
│   └── index.ts           # Cloudflare Worker (API + WebSocket + Durable Objects)
├── public/                # Static assets
├── wrangler.toml          # Cloudflare Workers config
└── package.json
```

---

## 🔧 Configuration

### 1. World Developer Portal Setup

1. Go to https://developer.worldcoin.org
2. Create a new app called "Mindalike"
3. Copy your **App ID** (e.g., `app_staging_xxxxx`)
4. Create an action called `verify_human` with Orb verification level
5. Add `world.mind-alike.com` to allowed origins

### 2. Environment Variables

Create `.env.local` for local development:

```env
NEXT_PUBLIC_APP_ID=app_staging_your_app_id
NEXT_PUBLIC_ACTION_ID=verify_human
```

For production, set these in Cloudflare Dashboard → Workers → mindalike → Settings → Variables.

---

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in browser (development simulation mode).

### Test with Wrangler

```bash
# Build and run with Cloudflare's local environment
npm run preview
```

This runs the full stack locally including Durable Objects.

---

## 🌐 Deployment

### Deploy to Cloudflare Workers

```bash
npm run deploy
```

This will:
1. Build the Next.js static site
2. Deploy to Cloudflare Workers
3. Configure custom domain `world.mind-alike.com`
4. Set up Durable Objects for real-time matching

### Custom Domain Setup

The `wrangler.toml` is configured for `world.mind-alike.com`. Cloudflare will:
- Automatically configure DNS
- Provision SSL certificates
- Route traffic to your Worker

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ws?username=xxx` | WS | WebSocket for matching |
| `/api/nonce` | GET | Generate SIWE nonce |
| `/api/verify-siwe` | POST | Verify wallet auth |
| `/api/verify-worldid` | POST | Verify World ID proof |
| `/api/queue-status` | GET | Queue statistics |

---

## 📱 User Flow

1. **Landing** → User opens app in World App
2. **Authenticate** → Sign in with World App wallet (SIWE)
3. **Verify** → Verify with World ID (Orb level)
4. **Match** → Click "Find Match" to enter queue
5. **Chat** → When matched, redirect to World Chat

---

## 🎨 Design System

The Mindalike mini app uses a design system aligned with the main Mindalike web2 application, adapted for World App's mobile-first environment.

### Color Palette

**Brand Colors:**
- `brand-primary`: `#1E90FF` (Dodger Blue) - Primary actions, CTAs
- `brand-heavy`: `#176FC7` - Hover states, emphasis
- `brand-subtle`: `#7BC3FF` - Backgrounds, subtle highlights

**Background Hierarchy:**
- `bg-1`: `#F6F6F6` (Pearl White) - Main background
- `bg-2`: `#EEF2F8` - Secondary background
- `bg-3`: `#FFFFFF` - Card/container backgrounds
- `bg-4`: `#E9F1FB` - Subtle blue-tinted background

**Text Colors:**
- `text-primary`: `#0F172A` - Main text
- `text-secondary`: `#1F2937` - Secondary text
- `text-tertiary`: `#4B5563` - Muted text
- `text-inverted`: `#FFFFFF` - Text on colored backgrounds

**Status Colors:**
- `success`: `#22C55E` - Success states
- `destructive`: `#EF4444` - Error states

**Border Colors:**
- `border-primary`: `#E0E7F1` - Main borders
- `border-secondary`: `#C6D4E5` - Medium emphasis
- `border-tertiary`: `#A5B8D1` - Strong emphasis

### Typography

**Font Families:**
- **Display/Headlines**: `Space Grotesk` - For headings and branding
- **Body/UI**: `Plus Jakarta Sans` - For body text and UI elements

**Type Scale:**
- `display-hero`: Responsive hero headlines (clamp 2.5rem → 6rem)
- `display-xl`: Large display text (clamp 2rem → 4.5rem)
- `heading-xl`: Section headings (clamp 1.75rem → 3rem)
- `heading-lg`: Subheadings (clamp 1.5rem → 2.25rem)
- `body-lg`: Large body text (1.125rem)
- `body-md`: Standard body text (1rem)
- `body-sm`: Small text (0.875rem)

### Components

**Button Variants:**
- `primary`: Brand blue with glow shadow, hover lift effect
- `secondary`: Light background with border, subtle hover
- `outline`: Transparent with border, hover border color change
- `ghost`: Minimal styling, hover background

**Button Sizes:**
- `sm`: `h-9` (36px) - Compact buttons
- `md`: `h-10` (40px) - Standard buttons
- `lg`: `h-11` (44px) - Primary CTAs (meets touch target minimum)

**Card Variants:**
- `default`: `bg-bg-4` with comic border and shadow
- `elevated`: `bg-bg-3` with enhanced shadow
- `bordered`: `bg-bg-3` with border, hover border change

### Spacing & Layout

**Spacing Rhythm:**
- Based on 8px base unit with Fibonacci progression
- Section gaps: `space-y-6 md:space-y-8`
- Content blocks: `space-y-3 md:space-y-4`
- Container padding: `px-4 sm:px-6 lg:px-8`

**Border Radius:**
- Standard: `rounded-md` (~0.65rem)
- Buttons: `rounded-lg`
- Cards: `rounded-md`

### Shadows

- `comic-shadow`: Standard card shadow
- `comic-shadow-lg`: Elevated cards
- `comic-shadow-xl`: Hero elements
- `glow-hero`: Hero glow effect (40px blur)
- `brand-primary`: Button glow shadow
- `brand-primary-hover`: Enhanced button hover shadow

### Animations & Micro-interactions

**Transitions:**
- Standard: `transition-all duration-200 ease-in-out`
- Buttons: Hover lift (`-translate-y-[1px]`) with shadow enhancement
- Active: `translate-y-0` for pressed effect

**Animations:**
- `animate-float`: Subtle vertical float (3s)
- `animate-glow`: Pulsing glow effect (2s)
- `animate-pulse`: Loading indicators
- `pulse-ring`: Matching queue indicator rings

**Performance Considerations:**
- Animations optimized for mobile performance
- Reduced shadow complexity on low-end devices
- Touch-friendly interactions (44px minimum touch targets)

### Accessibility

- WCAG AA compliant contrast ratios
- Visible focus rings on all interactive elements
- Full keyboard navigation support
- Screen reader friendly semantic HTML
- Safe area support for mobile devices

---

## 📚 Resources

- [World Developer Docs](https://docs.world.org/mini-apps)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [MiniKit SDK](https://www.npmjs.com/package/@worldcoin/minikit-js)

---

Built with 💙 for the World App ecosystem
