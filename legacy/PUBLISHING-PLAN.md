# Publishing Plan — Skillbooks Registry

## The Model: NPM, but for knowledge

NPM's genius: `npm login` → `npm publish` → available to the world. No gatekeepers, no approval queue, no editorial board. The registry is a dumb pipe that validates structure and stores packages. Quality is market-driven — good packages get used, bad ones don't.

We should follow the same model with one key difference: **Stripe Connect is the identity layer.** NPM has a spam problem because accounts are free and anonymous. Our publishers connect a real bank account to get paid — that's natural sybil resistance without adding friction for legitimate authors.

---

## Publishing Flow

### What `skillbook publish .` does:

```
1. Run `skillbook validate .` — must pass with 0 errors
2. Read .env.local for SKILLBOOK_KEY
3. Package: tar the book directory (exclude .git, node_modules, _build, .verify, .env*, sources/)
4. Compute content hash (SHA-256 of tarball)
5. Extract metadata from package.json + SKILL.md
6. POST to registry:
   - Tarball
   - Metadata (name, version, description, pages, price, etc.)
   - Content hash
   - Publisher API key
7. Registry validates:
   - API key is valid + has publisher role
   - Name is available (or owned by this publisher)
   - Version is valid semver bump from previous
   - Content hash doesn't match an existing book by another publisher
   - Tarball structure passes server-side validation
8. Registry stores:
   - Tarball in R2
   - Metadata in KV/D1
   - Extracts SKILL.md + TAG-INDEX.json for free serving
9. Returns: published URL, version, page count
```

### What the author sees:

```bash
$ skillbook publish .

═══════════════════════════════════════════
  📦 Publishing: eu-ai-act v2.1.0
═══════════════════════════════════════════

  ✅ Validation passed (0 errors, 2 warnings)
  ✅ Package created (94 pages, 847KB)
  ✅ Content hash: sha256-a1b2c3...
  ✅ Published to https://skillbooks.ai/eu-ai-act

  Version: 2.1.0 (minor bump — new pages cost credits, existing stay free)
  Pages: 94
  Price: $14.00 ($0.15/page)

═══════════════════════════════════════════
```

### Version updates:

```bash
# Bump version in package.json + SKILL.md
skillbook publish . --patch   # 2.1.0 → 2.1.1 (typo fix, no new charges)
skillbook publish . --minor   # 2.1.0 → 2.2.0 (new pages, new pages cost credits)
skillbook publish . --major   # 2.1.0 → 3.0.0 (rewrite, all pages re-metered)
```

Or the author bumps manually and runs `skillbook publish .`

---

## Identity & Gating

### Open by default, verified by Stripe

**No approval queue. No editorial review. No gatekeepers.**

Instead, we use economic identity:

1. **Sign up** at `skillbooks.ai/start` → choose "Start publishing"
2. **Stripe Connect onboarding** — real name, bank account, tax info
3. **Get API key** with `publisher` role
4. **Publish immediately** — no waiting

This gives us:
- **Real identity** — Stripe KYC is more thorough than any verification we'd build
- **Accountability** — publishers have a bank account tied to their identity
- **Natural sybil resistance** — creating fake Stripe Connect accounts at scale is hard and expensive
- **No friction for legitimate authors** — they need Stripe anyway to get paid

### Account types:

| Type | Can do | How to get |
|------|--------|-----------|
| **Anonymous** | Browse catalog, read SKILL.md | No account needed |
| **Consumer** | Buy credits, fetch pages | Stripe Checkout (buy a credit pack) |
| **Publisher** | All consumer rights + publish books | Stripe Connect onboarding |

---

## Anti-Sybil & Anti-Abuse

### The attack Brook described:
> Spammer publishes author's book first, then generates accounts to downvote the real one.

This is actually two attacks: **content theft** and **rating manipulation**. Different defenses for each.

### Defense Layer 1: Content Hashing (prevents theft)

Every publish computes a content hash. The registry checks:
- **Exact match?** Reject. "This content has already been published by [publisher]."
- **High similarity?** Flag for review. (Future: similarity scoring via embeddings)

The first publisher of a content hash owns it. If someone publishes your book, you file a DMCA-style takedown with proof of original authorship.

### Defense Layer 2: Publisher Identity (makes theft costly)

Stripe Connect = real identity. Publishing stolen content means:
- Your real name is on the Stripe account
- We can freeze payouts
- DMCA takedown has a real person to serve
- Repeat offenders get permanently banned (and Stripe flags the identity)

This is why open + Stripe is better than gated + anonymous: **the gate IS the identity.**

### Defense Layer 3: Consumer-Only Ratings (prevents vote manipulation)

Ratings/reviews can only be left by accounts that:
- Have a **consumer** account (paid real money via Stripe Checkout)
- Have **actually purchased pages** from the book they're rating
- Have a **minimum spend** threshold (e.g., at least $1 in lifetime purchases)

This means creating fake downvote accounts requires:
1. Creating a Stripe payment method (real card or bank account)
2. Actually buying credits ($10 minimum pack)
3. Purchasing pages from the target book
4. Only THEN being able to leave a rating

Cost to execute a meaningful downvote attack: **hundreds of dollars** in credit purchases, each tied to a traceable payment method. Not worth it.

### Defense Layer 4: Temporal Priority

- First publish of a name gets it. Period. (NPM model)
- Takedown claims require proof of prior art
- We log all publish timestamps with content hashes
- If two similar books appear, the earlier publish date wins disputes

### Defense Layer 5: Rate Limiting (makes everything slower for attackers)

- Max 3 books per publisher per day
- Max 1 account creation per payment method
- Publishing requires API key age > 1 hour (no drive-by publishes)
- Review posting: max 5 reviews per consumer per day

### What we DON'T need:

- ❌ Editorial review queue (doesn't scale, adds friction)
- ❌ Invite-only access (kills growth)
- ❌ Reputation scores on publishers (premature, creates new attack surface)
- ❌ Crypto-based identity (overengineered, Stripe is better KYC)

---

## Registry Architecture

### Storage:

```
Cloudflare Workers (API) ← already have this
├── R2: tarballs + extracted pages
├── KV: hot metadata (name → latest version, SKILL.md, TAG-INDEX.json)
└── D1: publishers, versions, content hashes, ratings, access logs
```

### API Endpoints:

```
POST   /api/publish          — upload tarball + metadata
GET    /api/catalog           — list all books (paginated)
GET    /api/catalog/:name     — book metadata + versions
GET    /:name/SKILL.md        — free (storefront)
GET    /:name/TAG-INDEX.json  — free (tag lookup)
GET    /:name/:path           — metered (requires API key + credits)
POST   /api/account           — create consumer/publisher account
GET    /api/account            — balance, type, books published
POST   /api/account/credits   — buy credits (Stripe Checkout)
POST   /api/ratings/:name     — leave rating (consumer-only)
GET    /api/ratings/:name     — read ratings
POST   /api/takedown/:name    — file content dispute
```

### What exists today (v0 worker):
- Page serving with API key auth
- 402 responses for unauthenticated requests
- Basic credit tracking

### What needs to be built:
- Publish endpoint (tarball upload, validation, storage)
- Account management (Stripe Connect for publishers, Checkout for consumers)
- Version management (semver validation, content hash dedup)
- Catalog endpoint (browse available books)
- Rating system (consumer-only, purchase-verified)
- Takedown/dispute flow

---

## Implementation Phases

### Phase 1: Minimum Publishable Flow
Get books from CLI to registry. No ratings, no catalog browsing.

1. `POST /api/publish` endpoint
2. Server-side validation (structure, name availability, semver)
3. Content hash computation + dedup check
4. R2 storage (tarball + extracted pages)
5. KV metadata update
6. `skillbook publish .` CLI command (package + upload)
7. Publisher auth via existing API key system

### Phase 2: Accounts & Payments
Proper signup, credit purchases, publisher payouts.

8. Stripe Connect integration (publisher onboarding)
9. Stripe Checkout integration (consumer credit packs)
10. `/api/account` endpoints
11. `skillbook login` → authenticate with API key from skillbooks.ai
12. `skillbook account` wired to live API
13. Publisher payout automation (monthly via Stripe Connect)

### Phase 3: Discovery & Trust
Help consumers find books, help good books surface.

14. `/api/catalog` with search + filters
15. Consumer-only rating system
16. Catalog page on skillbooks.ai
17. `skillbook search <query>` CLI command
18. Content similarity checking (embeddings-based, flag potential dupes)

### Phase 4: Ecosystem
19. `skillbook unpublish` (yank a version, NPM-style with time limit)
20. Takedown/dispute flow
21. Publisher analytics dashboard
22. Webhook notifications (new ratings, usage milestones)
23. CI/CD integration (`npm run publish` in GitHub Actions)

---

## Open Questions

1. **Source material in tarballs?** Probably not — sources/ can be large (PDFs). Publish only content pages + metadata. Sources stay in git for verification.
2. **Name squatting policy?** NPM has a dispute process. We should too. Suggested: names unused for 90 days can be claimed.
3. **Pricing floor/ceiling?** Should we enforce min/max prices? Probably not initially. Let the market decide.
4. **Free books?** Allow price: $0? Yes — good for adoption. Authors still need Stripe Connect (for identity), but can publish free content.
5. **Private/unlisted books?** Useful for enterprise. Phase 2+.
