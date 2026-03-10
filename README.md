# ⬡ OpsPulse

So the idea behind OpsPulse is pretty straightforward — I wanted to build a dashboard where a business owner or ops manager can open one tab and immediately know what's going on. No switching between analytics tools, no digging through spreadsheets. Just one screen with everything that matters.

It tracks five things: sales, inventory, cash flow, support tickets, and customer complaints. All in real-time, with a dark theme because let's be honest — staring at dashboards all day is way easier on dark mode.

## What makes it different

Instead of just throwing charts at you, the app calculates a **health score** — a single number that tells you how the business is doing overall. It's a weighted average across all five areas (revenue gets the highest weight at 28%, then cash flow at 25%, and so on). When something's off, you don't have to figure it out yourself — the alert engine picks it up and flags it as a crisis or an opportunity.

The complaints tab is probably the part I spent the most time on. You can search, filter by status/priority/sentiment, click into any complaint, see AI-suggested responses based on how angry the customer is, and update the status right there. It felt like the kind of thing that's usually a separate tool entirely.

## Tech stack

- **React 19** — everything's built with hooks, no class components
- **Vite 7** — fast dev server, instant hot reload
- **Recharts** — for the charts (area, bar, line, radar)
- **Vanilla CSS** — no Tailwind, just a custom design system with a lime-green accent
- **Google Fonts** — Bebas Neue for headings, DM Sans for body, JetBrains Mono for data

## How it's structured

The whole app lives in one file (`App.jsx`, around 1090 lines). I know that sounds like a lot but for a dashboard like this, splitting everything into 20 separate component files felt like overkill. Each section is clearly marked with comment headers so it's easy to navigate.

There's a `C` object at the top that acts as the design token system — all colors, fonts, border styles come from there. Change one value and it updates everywhere.

The data is generated randomly on load (no backend needed), but it's designed to look realistic — stock levels that sometimes dip below thresholds, cash balances that fluctuate naturally, complaints with different sentiment levels.

## Architecture

Here's roughly how everything connects:

```
App (root)
├── LandingPage          ← animated homepage with LivePreview
├── Onboarding           ← company name + industry selection
└── Dashboard            ← the main workspace
    ├── ScoreRing        ← circular health score visualization
    ├── KpiCard ×5       ← revenue, stock, cash, tickets, complaints
    ├── Tab Navigation   ← 8 tabs
    └── Tab Content
        ├── Overview     ← revenue chart + alerts + health bars
        ├── BusinessHealthTab  ← radar chart, score bars, advisories
        ├── RevenueTab         ← area + bar + line charts
        ├── InventoryTab       ← stock cards + comparison chart
        ├── CashFlowTab        ← balance trend + inflow/outflow
        ├── SupportTab         ← weekly metrics + daily cards
        ├── ComplaintsTab      ← search, filter, detail panel, AI responses
        └── AlertsTab          ← crisis + opportunity feed
```

**Data flow** is pretty simple — the Dashboard component generates all the data on mount using `useState(genSales)`, `useState(genInventory)`, etc. Each generator returns realistic randomized data. That data flows down as props to whichever tab you're on.

The **health score** is computed via `useMemo` — it watches all five data arrays and recalculates whenever something changes (like when you resolve a complaint). The formula weighs revenue and cash flow the heaviest because those are what actually keep a business alive. The result drives the score ring color, the label (THRIVING / STABLE / AT RISK / CRITICAL), and the nav bar indicator.

**Alerts** work the same way — `useMemo` runs `genAlerts()` which checks for things like low stock, cash below $55k, escalated tickets above 8, conversion spikes, and unresolved angry complaints. If a condition is met, it pushes an alert object. Simple threshold-based logic, no ML or anything fancy.

The **complaints system** is the only part with two-way data flow — `setComplaints` gets passed down so you can update statuses and add responses directly from the detail panel.

## The flow

1. You land on an animated homepage with a live mini-dashboard that actually updates
2. Quick onboarding — enter your company name, pick your industry
3. Dashboard opens with 8 tabs: Overview, Health, Revenue, Inventory, Cash Flow, Support, Complaints, and Alerts
4. There's a War Room toggle that throws a red banner across the top for when things get serious
5. Owner/Ops switch lets you flip between high-level and detailed views

## Running it

```bash
npm install
npm run dev
```

That's it. No env variables, no backend, just runs on localhost.
