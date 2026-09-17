Iya. Setelah melihat kembali **tiga audit utama yang kamu berikan** dan mencocokkannya dengan guidance Carbon yang sekarang, saya akan membuat plan ini sedikit lebih ketat dari rencana sebelumnya.

Kuncinya:

> **Agent tidak boleh “mendesain ulang MOVA”. Agent hanya boleh melakukan Carbon Adoption terhadap frontend MOVA yang sudah ada.**

Ini penting karena audit arsitektur menunjukkan fondasi integration layer, service, state, dan domain component sudah cukup matang; perubahan visual seharusnya tidak menyentuh business logic/API. Audit juga secara eksplisit menempatkan arsitektur target sebagai `Carbon Productive Principles → MOVA tokens → Tailwind → primitives → domain components → pages`. 

Carbon sendiri memang dirancang sebagai fondasi yang kemudian dapat diperluas untuk kebutuhan bisnis spesifik, dan komponennya dimaksudkan untuk dipakai secara sistematis agar konsistensi visual dan fungsional terjaga. ([Carbon Design System][1])

## Keputusan yang saya sarankan

Untuk **fase ini**, kita kunci:

```text
IBM Carbon Design Language
        │
        │ 100% visual guidance
        ▼
MOVA Carbon Adoption
        │
        ├── typography
        ├── color methodology
        ├── grid
        ├── spacing
        ├── layers
        ├── components
        ├── iconography
        ├── interaction
        ├── accessibility
        └── content style
        │
        ▼
Existing MOVA functionality
```

**Belum:**

* MOVA orange sebagai brand system utama
* custom MOVA visual language
* custom decorative identity
* custom illustration
* custom motion language
* custom radius philosophy
* custom “MOVA look”

Logo tetap boleh dipertahankan sebagai **product identifier**, tetapi bukan menjadi alasan untuk menyimpang dari Carbon.

Saya juga belum memasukkan isi `designCistitution.md` sebagai aturan konkret karena file tersebut belum muncul dalam hasil file yang bisa saya baca. Jadi Agent nanti harus **membaca file tersebut langsung dari repository** sebelum eksekusi dan memperlakukannya sebagai instruction layer tambahan.

Berikut dokumen yang menurut saya paling tepat kamu berikan ke Agent.

# MOVA — IBM Carbon Adoption Plan

**Status:** Execution Specification
**Target:** `apps/single-tenant/nodejs_react/frontend`
**Design Authority:** IBM Carbon Design System
**Scope:** Visual/design-system adoption only
**Business Logic:** LOCKED
**API Contracts:** LOCKED
**Data Layer:** LOCKED
**Domain Logic:** LOCKED

---

# 0. Mission

Migrate the existing MOVA Single-Tenant frontend toward **IBM Carbon Design System** as the primary and authoritative visual language.

This is a **design-system adoption**, not a frontend rewrite.

The Agent must preserve:

* existing routes
* existing page behavior
* existing API integrations
* existing TanStack Query usage
* existing service layer
* existing state management
* existing GIS behavior
* existing DSS behavior
* existing distribution behavior
* existing rider operational behavior
* existing authentication behavior
* existing RBAC behavior
* existing data contracts
* existing domain components where their logic is valid

The primary objective is:

> Replace the existing visual language with Carbon's productive, systematic, accessible, enterprise-oriented design language without changing application behavior.

---

# 1. Source of Truth Hierarchy

The Agent MUST follow this authority order:

```text
1. IBM Carbon Design System
2. /brief/designCistitution.md
3. Existing MOVA frontend architecture
4. Existing MOVA component contracts
5. Existing MOVA API/data contracts
6. Existing page implementation
```

If two visual decisions conflict:

```text
IBM Carbon
    >
designCistitution.md
    >
existing MOVA styling
```

Existing styling must NOT override Carbon.

However:

```text
Existing business logic
    >
visual migration
```

The Agent must never modify business behavior merely to make a component visually easier to migrate.

---

# 2. Critical Principle

The Agent is NOT allowed to invent a new MOVA visual language.

Do not interpret this task as:

> "Create a modern MOVA design."

Interpret it as:

> "Apply IBM Carbon Design System guidance to the existing MOVA application."

Carbon is the design authority.

MOVA-specific visual decisions are intentionally deferred.

---

# 3. Brand Scope for This Phase

Temporarily minimize custom MOVA branding.

## Keep

### Product name

`MOVA`

### Logo

Keep the existing MOVA logo where the product identity requires it.

Do not redesign the logo.

Do not add decorative logo effects.

Do not add glow.

Do not add gradients to the logo container unless the existing logo asset itself requires it.

Do not create a custom logo treatment merely to make the interface feel more branded.

### Product terminology

Keep existing domain terminology where it is necessary for product meaning.

Examples:

* MOVA
* Map Ops
* Rider
* Zone
* Distribution
* DSS
* POI
* Weather
* Fleet
* Reports

However, visual/content treatment must follow Carbon content guidance.

---

# 4. Explicitly Defer MOVA Brand Identity

Do NOT implement the following as a custom design layer yet:

* MOVA Signature Orange as a global visual identity
* custom MOVA color palette
* custom branded gradients
* custom decorative patterns
* custom illustration language
* custom marketing visual language
* custom hero treatment
* custom motion identity
* custom branded shadows
* custom branded radii
* custom branded card style

These belong to a later phase.

For this adoption phase:

> Carbon first. MOVA branding later.

---

# 5. Carbon Adoption Principle

Use Carbon wherever Carbon already provides an established pattern.

Carbon provides reusable components for common interface problems such as:

* Button
* Checkbox
* Dropdown
* Form
* Data Table
* Modal
* Notification
* Pagination
* Search
* Select
* Tabs
* Tag
* Text Input
* Tooltip
* UI Shell
* etc.

The Agent must prefer an existing Carbon pattern over inventing a custom pattern.

Reference:

[https://carbondesignsystem.com/components/overview/components/](https://carbondesignsystem.com/components/overview/components/)

---

# 6. Existing Architecture Must Not Be Rebuilt

The frontend audit already establishes that the Single-Tenant application contains:

* React 19
* Vite
* Tailwind CSS
* TanStack React Query
* Axios
* existing UI primitives
* AppLayout
* Sidebar
* Topbar
* domain components
* centralized services

The visual migration must operate within this architecture.

Do NOT:

* rewrite the application
* replace routing
* replace TanStack Query
* rewrite services
* rewrite API calls
* rewrite domain calculations
* rewrite DSS
* rewrite GIS logic
* rewrite authentication
* rewrite RBAC
* replace PostGIS integration
* introduce a new application architecture

The audit explicitly identifies the frontend as a pure consumer of backend contracts and preserves data lineage as a critical invariant. 

---

# 7. Migration Strategy

Do NOT modify every page at once.

Follow this order:

```text
PHASE 0
Repository reconnaissance
        ↓
PHASE 1
Carbon foundation
        ↓
PHASE 2
Tokens + global styling
        ↓
PHASE 3
Core primitives
        ↓
PHASE 4
Application shell
        ↓
PHASE 5
Showcase / visual verification
        ↓
PHASE 6
Map Ops reference implementation
        ↓
PHASE 7
Remaining pages
        ↓
PHASE 8
Regression + Carbon compliance
```

This follows the existing audit recommendation to stabilize tokens, global CSS, AppShell, Sidebar, Topbar, and shared primitives before page-by-page migration. 

---

# 8. PHASE 0 — Repository Reconnaissance

Before changing code:

1. Read `/brief/designCistitution.md`.
2. Read existing frontend design-system documents.
3. Inspect current component tree.
4. Identify global CSS.
5. Identify Tailwind configuration.
6. Identify existing UI primitives.
7. Identify AppShell.
8. Identify Sidebar.
9. Identify Topbar.
10. Identify shared Card/Panel/Button/Input/Select/Table/Dialog/Badge components.
11. Identify all page-local visual styling.
12. Identify all hardcoded colors.
13. Identify arbitrary Tailwind values.
14. Identify custom shadows.
15. Identify large radii.
16. Identify decorative gradients.
17. Identify icon usage.
18. Identify emoji usage.
19. Identify page-local typography.
20. Identify duplicated primitives.

Do not modify code during reconnaissance.

Produce a migration inventory before implementation.

---

# 9. PHASE 1 — Carbon Foundation

Establish Carbon-compatible foundations for:

* typography
* color
* spacing
* grid
* layers
* borders
* focus states
* interactive states
* accessibility
* iconography

Carbon's 2x Grid establishes the geometric foundation for typography, columns, boxes, icons, margins, and padding. Its basic mini-unit is 8px. ([Carbon Design System][2])

Carbon's spacing system uses a systematic scale based on multiples of 2, 4, and 8. ([Carbon Design System][3])

Therefore:

> Remove arbitrary visual values whenever a Carbon token or spacing value can represent the same intent.

---

# 10. Typography

Use Carbon's **productive typography philosophy**.

MOVA is an operational product, not an editorial website.

Carbon explicitly distinguishes productive typography for product interfaces from expressive typography for editorial experiences. ([Carbon Design System][4])

Do not create:

* oversized marketing headings
* decorative typography
* random font sizes
* page-specific typography systems
* typography used as decoration

Typography must communicate:

```text
information hierarchy
    ↓
content importance
    ↓
operational readability
```

Do not introduce JetBrains Mono simply for visual style.

If numeric presentation requires special treatment, first evaluate Carbon's existing type and data patterns.

---

# 11. Color

Use Carbon's color methodology.

Color must communicate:

* action
* state
* hierarchy
* interaction
* feedback

Color must NOT be used merely to make the dashboard look attractive.

Carbon explicitly recommends neutral treatment for running text and warns against using color decoratively. ([Carbon Design System][5])

Do not implement the previous MOVA orange palette during this phase.

Do not preserve arbitrary old colors merely because they exist.

Map existing colors to Carbon semantic roles.

---

# 12. Accessibility

Accessibility is part of adoption, not a later polish step.

Minimum requirements:

* keyboard navigation
* visible focus
* accessible labels
* sufficient contrast
* semantic HTML
* correct interactive states
* accessible icon-only controls
* no color-only meaning
* responsive behavior
* reduced-motion consideration

Carbon targets WCAG AA contrast requirements and explicitly states that color must not be the sole carrier of meaning. ([Carbon Design System][6])

Carbon components also have an established accessibility testing framework. ([Carbon Design System][7])

---

# 13. Iconography

Adopt Carbon iconography discipline.

Icons must:

* communicate meaning
* remain consistent in scale
* remain monochromatic
* align correctly with text
* avoid decoration

Carbon documents 16px, 20px, 24px, and 32px icon sizes and requires consistent sizing. Interactive icon touch targets should be at least 44px. ([Carbon Design System][8])

Remove:

* emoji
* decorative icons
* random colored icons
* icon + label combinations with no semantic purpose
* unnecessary icon-only controls

Do not introduce multiple icon libraries.

If the existing implementation uses Lucide, do not replace the entire codebase solely for icon-library purity unless the migration can be performed safely.

The priority is:

> Carbon iconography principles > library replacement.

---

# 14. Existing Anti-AI Findings

The visual forensic audit identified:

* 48 hardcoded hex colors
* 112 arbitrary Tailwind bracket values
* 34 large border radii
* 22 heavy glow/shadow effects
* 19 icon-only buttons without labels/tooltips

These are the baseline migration targets. 

The Agent must specifically remove or normalize these issues.

---

# 15. Remove AI Aesthetic Tax

The following are prohibited unless Carbon explicitly requires them:

* sparkle icons
* AI emojis
* decorative emojis
* glowing buttons
* radiant shadows
* glassmorphism
* excessive backdrop blur
* giant rounded cards
* excessive pills
* decorative hero visuals
* decorative dashboard illustrations
* marketing-style gradients
* decorative KPI animations

The existing forensic audit already classifies these as migration targets, including P0 sparkles/emojis, P0 decorative DSS hero visuals, P1 glow/shadows, P1 glassmorphism, and P2 excessive rounded corners. 

---

# 16. Component Migration Rules

Every existing shared primitive must be evaluated.

## Button

Preserve:

* click behavior
* loading behavior
* disabled behavior
* async behavior
* event handlers

Change:

* geometry
* typography
* color
* border
* focus
* hover
* active states

Do not add decorative effects.

---

## Input / Select

Preserve:

* form integration
* validation
* values
* event handling

Change:

* Carbon-compatible geometry
* label treatment
* border
* focus state
* error state
* helper text
* spacing

---

## Card

Do not blindly preserve the old "card" concept.

Evaluate whether the content should instead become:

* Carbon layer
* panel
* structured content area
* data table
* tile
* side panel
* inline section

The existing audit explicitly identifies Card as requiring structural refactoring and recommends removing unnecessary floating-card treatment. 

---

## MetricCard / StatCard

Do not preserve decorative KPI cards.

Transform them into quiet information structures.

Preserve:

* metric value
* label
* trend/status
* data source

Remove:

* gradients
* glow
* decorative icon backgrounds
* excessive radius
* unnecessary animation

---

## Table

Move toward Carbon Data Table patterns.

Preserve:

* data
* sorting
* filtering
* pagination
* row actions
* API integration

Change:

* density
* header treatment
* spacing
* states
* selection
* interaction

Carbon provides a dedicated Data Table component and usage/code guidance. ([Carbon Design System][9])

---

## Modal / Drawer

Preserve:

* business flow
* form submission
* API calls
* state transitions

Change only presentation and interaction treatment.

---

## Badge / Status

Use semantic status treatment.

Do not use color as decoration.

Status must remain understandable even without color.

---

# 17. Application Shell

Migrate in this order:

```text
AppShell
    ↓
Sidebar
    ↓
Topbar
    ↓
Navigation states
    ↓
Page container
```

The goal is a Carbon-like productive shell.

Do not introduce:

* hover-expand sidebar
* floating glass sidebar
* oversized navigation icons
* decorative navigation backgrounds
* animated navigation gimmicks

The existing design-system audit already prohibits hover-expanding sidebar and role-specific visual redesign. 

---

# 18. Navigation

Keep current routes and permissions.

Visual restructuring is allowed only if it does not break routing.

Existing proposed information architecture can be retained as a functional organization:

```text
Home
Operations
Intelligence
Reporting
Data
Administration
```

But do not redesign route behavior merely for visual reasons.

---

# 19. Map Ops

Map Ops becomes the first major reference page.

Important:

> Do not redesign GIS behavior.

Preserve:

* Leaflet
* zones
* rider locations
* POI
* weather
* geofencing
* layer logic
* map interactions
* spatial state

Only redesign the UI surrounding the map.

The visual forensic audit classifies `Leaflet Map Canvas` as a MOVA-specific component and recommends preserving GIS logic while placing it inside a calmer control-room frame. 

---

# 20. MOVA-Specific Components

Carbon should own generic UI.

MOVA should own domain-specific components.

Examples:

```text
Carbon
├── Button
├── Input
├── Select
├── DataTable
├── Modal
├── Notification
├── Tabs
├── Tag
├── Tooltip
└── UI Shell

MOVA Domain
├── ZoneMap
├── RiderOperationalStatus
├── DistributionWorkspace
├── DSSMatrix
├── ZoneRecommendation
├── WeatherOperationalPanel
└── RiderOperationalSession
```

MOVA-specific components must inherit Carbon's:

* spacing
* typography
* color logic
* interaction model
* accessibility
* component geometry

Do not create a second visual system inside these components.

---

# 21. DSS

Preserve all DSS logic.

Do not alter:

* BWM
* TOPSIS
* weights
* criteria
* scores
* ranking
* explainability
* API contracts

Only change presentation.

Remove decorative concepts such as:

* sparkles
* AI brain icons
* decorative DSS hero
* artificial "AI intelligence" visualizations

The forensic audit specifically identified `DssMapVisual` as a decorative visual that should be removed. 

Use data hierarchy instead.

---

# 22. Data Integrity Rule

Never introduce fake data during visual migration.

Never:

```text
0
Rp 0
fake rider
fake zone
fake score
fake weather
fake recommendation
```

merely because the UI needs something to render.

Preserve existing semantic states such as:

```text
NO_DATA
VALID
DEGRADED
FRESH
CACHED
PROTECTED_ROLE
```

The existing data audit explicitly requires semantic state preservation and prohibits phantom/mock business data. 

---

# 23. No Page-Level Design Decisions

Pages should consume the design system.

Do not create:

```text
page-specific colors
page-specific radius
page-specific typography
page-specific shadows
page-specific buttons
page-specific input geometry
```

The existing design-system specification explicitly prohibits page-level duplication of these visual decisions. 

If a page requires a new visual pattern:

```text
Page need
    ↓
Evaluate Carbon
    ↓
Evaluate existing primitive
    ↓
Extend shared component if necessary
    ↓
Then use it on page
```

Never solve systemic problems with page-local CSS.

---

# 24. Showcase as Verification Surface

Before migrating all pages, establish or update the existing `/showcase`.

The showcase should verify:

```text
Buttons
Inputs
Selects
Tables
Tabs
Badges
Tags
Metrics
Dialogs
Drawers
Notifications
Loading
Empty
Error
Focus
Keyboard
Responsive
Dark mode
Map-specific UI
```

The existing MOVA design-system specification already defines Showcase as a living visual verification surface. 

---

# 25. Migration Order

After the foundation is stable:

```text
1. AppShell
2. Sidebar
3. Topbar
4. Shared primitives
5. Showcase
6. Dashboard
7. Map Ops
8. Zone Operations
9. Distribution
10. DSS
11. Reports
12. POI
13. Weather
14. Fleet
15. Riders
16. Catalog
17. Users
18. Settings
19. Auth
20. Onboarding
```

Do not migrate multiple complex pages simultaneously.

---

# 26. Git Safety

Before each migration phase:

```text
git status
git diff
```

Create a checkpoint commit.

Recommended checkpoints:

```text
carbon-adoption/01-foundation
carbon-adoption/02-tokens
carbon-adoption/03-primitives
carbon-adoption/04-shell
carbon-adoption/05-showcase
carbon-adoption/06-map-ops
```

If a phase causes behavioral regression:

> Revert the visual phase rather than modifying business logic to compensate.

---

# 27. Forbidden Changes

The Agent MUST NOT:

* rewrite backend
* modify API contracts
* modify database schema
* modify services
* modify business algorithms
* modify DSS calculations
* modify GIS calculations
* modify authentication logic
* modify RBAC logic
* modify routing behavior without explicit requirement
* introduce fake data
* introduce new state management
* replace working dependencies without necessity
* redesign business workflows
* add decorative AI UI
* add gradients merely for aesthetics
* add glow
* add glassmorphism
* add excessive animation
* add emoji
* create arbitrary visual tokens

---

# 28. Carbon Compliance Gate

A migrated component is complete only when:

```text
[ ] Carbon pattern evaluated
[ ] Existing behavior preserved
[ ] Existing API untouched
[ ] Existing state management untouched
[ ] Existing data contract untouched
[ ] Typography follows Carbon
[ ] Spacing follows Carbon
[ ] Color follows semantic Carbon methodology
[ ] Border/layer treatment follows Carbon
[ ] No decorative gradient
[ ] No glow
[ ] No glassmorphism
[ ] No decorative emoji
[ ] No unnecessary icon
[ ] Focus state exists
[ ] Keyboard behavior preserved
[ ] Accessible label exists where required
[ ] Responsive behavior preserved
[ ] No page-local design-system duplication
```

---

# 29. Definition of Done — Adoption Phase

The Carbon Adoption Phase is complete when:

### Foundation

```text
[ ] Carbon design principles documented
[ ] Carbon token strategy established
[ ] typography standardized
[ ] spacing standardized
[ ] grid standardized
[ ] layers standardized
[ ] color roles standardized
[ ] iconography standardized
```

### Components

```text
[ ] Button
[ ] Input
[ ] Select
[ ] Table
[ ] Badge
[ ] Status
[ ] Modal
[ ] Drawer
[ ] Tabs
[ ] Notification
[ ] Loading
[ ] Empty
[ ] Error
```

follow the Carbon direction.

### Shell

```text
[ ] AppShell
[ ] Sidebar
[ ] Topbar
[ ] Navigation states
```

are standardized.

### Visual cleanup

```text
[ ] no decorative emoji
[ ] no sparkle
[ ] no glow
[ ] no glassmorphism
[ ] no excessive gradients
[ ] no giant cards
[ ] no arbitrary radius
[ ] no arbitrary spacing
[ ] no arbitrary page typography
```

### Regression

```text
[ ] routes still work
[ ] API calls still work
[ ] forms still work
[ ] authentication still works
[ ] RBAC still works
[ ] GIS still works
[ ] DSS still works
[ ] distribution still works
[ ] rider operations still work
[ ] loading/error/empty states still work
```

---

# 30. Final Agent Instruction

The Agent must constantly ask:

> "Am I implementing IBM Carbon, or am I inventing a new design?"

If the answer is:

```text
inventing
```

stop and reconsider.

The correct behavior is:

```text
Existing MOVA functionality
        +
IBM Carbon visual system
        =
MOVA Carbon Adoption
```

Not:

```text
Existing MOVA functionality
        +
AI-generated aesthetic
        =
new MOVA design
```

The purpose of this phase is not to make MOVA look more impressive.

The purpose is to make MOVA:

**systematic, calm, precise, accessible, consistent, and operational.**

MOVA branding can be deliberately reintroduced after Carbon compliance is stable.

### Yang paling penting: saya ingin Agent bekerja dengan mode **surgical migration**

Berdasarkan audit, ini bukan saatnya Agent melakukan `rewrite frontend`. Audit arsitektur justru menunjukkan bahwa kita sudah punya primitive dan domain architecture yang bisa dipertahankan; misalnya Button/Input/Select/Table perlu **styling/refactor**, sementara Leaflet Map dan DSS Matrix tetap domain-specific. 

Dan angka forensic tadi menjadi **migration backlog**, bukan alasan untuk membongkar aplikasi: 48 hex, 112 arbitrary Tailwind values, 34 radius besar, 22 glow/shadow, dan 19 icon-only controls. 

### Satu hal yang saya ubah dari rencana lama

**Jangan langsung bikin `mova-tokens.css` dengan warna MOVA orange.**

Itu terlalu cepat.

Carbon sendiri memandang design language sebagai fondasi yang diterjemahkan ke tokens, grid, type, dan components. ([Carbon Design System][10]) Jadi fase pertama harus benar-benar menghasilkan **Carbon baseline** terlebih dahulu.

Baru nanti:

```text
PHASE A
IBM Carbon Adoption
        ↓
PHASE B
Carbon Compliance
        ↓
PHASE C
MOVA Brand Layer
        ↓
MOVA Orange
MOVA Logo refinement
MOVA terminology refinement
MOVA visual identity
        ↓
PHASE D
Domain-specific MOVA language
```

Ini menurutku jauh lebih aman.

**Dan `designCistitution.md` yang sudah kamu buat di `/brief` sebaiknya menjadi guardrail Agent, bukan digantikan.** Agent wajib membacanya sebelum menyentuh kode, lalu jika ada konflik dengan implementasi lama, **ikuti Constitution + Carbon**, bukan style lama.

Carbon juga sekarang memiliki **Carbon MCP public preview** yang memang menyediakan knowledge base untuk guidance, components, iconography, usage, accessibility, dan code examples—bahkan ada `docs_search` dan `code_search`. Ini sangat relevan kalau nantinya Agent kamu bisa mengakses MCP tersebut, karena kita bisa mengurangi ketergantungan Agent pada “ingatan” model mengenai Carbon. ([Carbon Design System][11])

[1]: https://carbondesignsystem.com/all-about-carbon/the-carbon-ecosystem/?utm_source=chatgpt.com "Carbon Design System"
[2]: https://carbondesignsystem.com/elements/2x-grid/overview/?utm_source=chatgpt.com "Carbon Design System"
[3]: https://carbondesignsystem.com/elements/spacing/overview/?utm_source=chatgpt.com "Carbon Design System"
[4]: https://carbondesignsystem.com/elements/typography/style-strategies/?utm_source=chatgpt.com "Carbon Design System"
[5]: https://carbondesignsystem.com/elements/typography/overview/?utm_source=chatgpt.com "Carbon Design System"
[6]: https://carbondesignsystem.com/guidelines/accessibility/color/?utm_source=chatgpt.com "Carbon Design System"
[7]: https://carbondesignsystem.com/components/overview/accessibility-status/?utm_source=chatgpt.com "Carbon Design System"
[8]: https://carbondesignsystem.com/elements/icons/usage/?utm_source=chatgpt.com "Carbon Design System"
[9]: https://carbondesignsystem.com/components/data-table/code/?utm_source=chatgpt.com "Carbon Design System"
[10]: https://carbondesignsystem.com/designing/get-started/?utm_source=chatgpt.com "Carbon Design System"
[11]: https://carbondesignsystem.com/developing/carbon-mcp/overview/?utm_source=chatgpt.com "Carbon Design System"
