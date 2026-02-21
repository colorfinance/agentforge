# AgentForge - Build Roadmap

## Mission
Build a fully functional AI agent skills marketplace with auto-execution and crypto payments.

---

## Current Status: MVP Complete ✅

**Running at:** http://localhost:3000/
**Name:** AgentForge
**Payment:** Crypto-only (USDT/ETH/SOL)
**Featured Skills:** Content Generator, Crypto Scanner, Web Research
**Skills:** 8 demo skills loaded
**Database:** SQLite with full schema

---

## Build Order

### PHASE 1: CORE EXECUTION (Week 1)
- [ ] 1.1 Real OpenClaw Agent Execution Engine
- [x] 1.2 Crypto Payment Flow (USDT/ETH/SOL)
- [ ] 1.3 User Authentication (Wallet-based)

### PHASE 2: SELLER DASHBOARD (Week 2)
- [ ] 2.1 Seller Dashboard UI
- [ ] 2.2 Order History
- [ ] 2.3 Skill Management (CRUD)

### PHASE 3: GROWTH (Week 3)
- [ ] 3.1 Search & Filtering
- [ ] 3.2 Reviews & Ratings
- [ ] 3.3 Email Notifications

### PHASE 4: LAUNCH (Week 4)
- [ ] 4.1 SEO Optimization
- [ ] 4.2 Social Sharing
- [ ] 4.3 Analytics Dashboard

---

## Technical Architecture

### Database (SQLite → Supabase later)
- `users` - Buyers and sellers
- `skills` - Sellable skills with input schemas
- `transactions` - Purchases
- `executions` - Actual skill runs
- `reviews` - Ratings
- `categories` - Skill categories

### API Endpoints
```
GET    /api/skills           - List all skills
GET    /api/skills/:id       - Skill details
POST   /api/skills           - Create skill
POST   /api/execute          - Execute skill
POST   /api/transactions     - Create purchase
POST   /api/payments/*       - Payment handling
GET    /api/users/:wallet     - User profile
POST   /api/reviews          - Leave review
```

### Execution Engine
- Spawns OpenClaw agents based on skill type
- Captures output and returns to buyer
- Timeout handling (5 min default)
- Retry logic (1x)

---

## Skills Inventory (8 Current)

| # | Skill | Price | Category | Featured |
|---|-------|-------|----------|----------|
| 1 | Content Generator | $15 | Marketing | ⭐ Yes |
| 2 | Crypto Scanner | $10 | Finance | ⭐ Yes |
| 3 | Web Research | $25 | Research | ⭐ Yes |
| 4 | Competitor Monitor | $20 | Marketing | No |
| 5 | Meeting Prep | $10 | Productivity | No |
| 6 | Email Triage | $5 | Productivity | No |
| 7 | Document Summarizer | $5 | Productivity | No |
| 8 | Image Generator | $0.50 | Design | No |

---

## Revenue Targets

| Milestone | Target | Timeline |
|-----------|--------|----------|
| MVP | Running | DONE |
| First Customer | 1 sale | Week 1 |
| $100 MRR | 10 customers | Week 2 |
| $1,000 MRR | 50 customers | Week 4 |
| $5,000 MRR | 200 customers | Month 2 |

---

## Dependencies

### npm packages (installed)
- express
- sql.js
- stripe
- cors
- helmet
- dotenv

### External Services
- Stripe (payments)
- OpenClaw (execution)
- SendGrid (email - optional)
- Supabase (future DB upgrade)

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/api/server.js` | Main API server |
| `src/db/index.js` | Database helpers |
| `src/execution/engine.js` | Execution engine |
| `public/index.html` | Landing page |
| `public/app.js` | Frontend JS |
| `public/styles.css` | Styling |
| `schema.sql` | Database schema |

---

## Next Action
Start Phase 1: Real OpenClaw Execution Engine
