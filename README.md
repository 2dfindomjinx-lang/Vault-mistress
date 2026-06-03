# Vault Mistress

A browser-based progression game centered around loyalty, collection, progression, and recurring engagement systems.

Built with Next.js, TypeScript, Tailwind CSS, Supabase, and Vercel.

## Features

### Account System

* Login with X (Twitter)
* Guest mode for local testing
* Persistent cloud saves via Supabase

### Coin Economy

* Daily tasks
* Higher or Lower
* Number Pick
* Beg mechanic
* Tribute system
* Coin transaction history
* Recent Tribute ticker

### Affection System

Increase affection through various interactions.

Affection unlocks:

* Rare Gallery rewards
* Divine Gallery rewards
* Secret content
* Principessa's Pet progression path

### Gallery System

* Common unlocks
* Rare unlocks
* Divine unlocks
* Hidden rewards
* Separate Pet Gallery progression

### Leadership

Compete against other users through Tribute contribution.

Features:

* Rank titles
* Top 3 leaderboard
* Hidden leaderboard support
* Tribute tracking

### Loyalty System

Daily participation increases Loyalty Streak.

Used by:

* Jackpot eligibility
* Progression systems
* Future event mechanics

### IRL Task Wheel

Randomized real-world challenge system.

Features:

* Admin review support
* Timeout penalties
* Shame tracking
* Completion history

### Principessa's Pet

Late-game progression system unlocked through Affection.

Features:

* Independent Pet Score progression
* Pet Ranks
* Weekly Tax system
* Debt Contracts
* Pet Gallery
* Pet Tasks
* Daily Restrictions
* Milestones
* Long-term progression mechanics

### Administration Tools

* Admin panel
* Coin management
* Tribute management
* Timeout management
* Leaderboard visibility controls
* Recent Tribute management

## Technology Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Supabase
* PostgreSQL
* Row Level Security (RLS)

### Deployment

* Vercel

## Database Highlights

Core tables:

* profiles
* user_tasks
* user_pet_tasks
* user_gallery
* user_pet_gallery
* unlocked_gallery_items
* coin_transactions
* user_irl_tasks
* pet_debt_contracts

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build production version:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Project Status

Actively developed.

Features, balancing, progression systems, and economy mechanics are continuously being expanded and adjusted.
