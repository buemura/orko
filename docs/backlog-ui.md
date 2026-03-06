# UI Package Backlog

> Consolidated from Claude and Codex analyses of `@synkro/ui` (v0.2.0)
> Scope: `packages/ui` — Files: `src/index.ts`, `src/handler.ts`, `src/dashboard.ts`

Items are organized by priority (P0 > P1 > P2 > P3). Security-sensitive items are tagged with `[SEC]`.

---

## P0 - Critical

### TD-02: Dashboard publicly exposed with no auth hook `[SEC]`
**File:** `src/handler.ts` serves dashboard and APIs directly
Operational metadata (event names, workflow topology, metrics) is accessible if route is exposed externally. No auth/allowlist option in `DashboardOptions`. **Security note:** Unauthenticated access leaks internal system architecture, event types, workflow topology, and operational metrics to anyone who can reach the endpoint.
**AC:** Add optional auth guard hook (or middleware adapter) and document secure-by-default deployment guidance.

### TD-11: HTML string concatenation pattern (XSS risk) `[SEC]`
**File:** `src/dashboard.ts` — renderDashboard, renderWorkflowDetail, etc.
All rendering done via `html += '...'` string concatenation. While `esc()` is used for user data, the pattern is fragile — easy to miss an escaping call on new fields. **Security note:** A single missed `esc()` call introduces a stored XSS vulnerability via event names or workflow metadata.
**AC:** Consider a tagged template literal helper that auto-escapes interpolations.

### TD-03: No automated tests
Zero tests for handler routing logic, `normalizeBasePath`, HTML output, or client rendering. Regressions go unnoticed. `package.json` has no `test` script and no test files.
**AC:** Add vitest unit tests for `createDashboardHandler` (route matching, status codes, content types) and `normalizeBasePath`. Add browser-level smoke tests for dashboard rendering/navigation. CI runs UI tests before publish.

---

## P1 - High

### TD-01: Fragile request path parsing in HTTP handler `[SEC]`
**File:** `src/handler.ts:23-25`
Query strings and partial base-path matches can route incorrectly, causing unexpected 404s or wrong endpoint matching. Raw `req.url` and `url.replace(basePath, "")` used instead of parsed pathname + strict prefix match. **Security note:** Path traversal or route confusion bugs can expose unintended endpoints or bypass intended access controls.
**AC:** Handler parses URL via `new URL(req.url, base)` and validates mount prefix with explicit boundary checks.

### TD-04: Monolithic inline dashboard implementation
**File:** `src/dashboard.ts:1-643`
643-line template literal containing HTML, CSS, and JS with all routing, rendering, SVG drawing, and state management. No separation of concerns, no IDE support for embedded code.
**AC:** Split rendering, state, and flow drawing into modular functions/files. Extract client-side JS into a separate file bundled at build time.

### TD-05: Runtime CDN dependency for Tailwind CSS `[SEC]`
**File:** `src/dashboard.ts:14`; `README.md:34`
Loads Tailwind via `https://cdn.tailwindcss.com` (play CDN, not recommended for production). No offline support, FOUC risk, performance penalty, larger payload. Conflicts with "zero dependencies" claim in README. **Security note:** External CDN dependency introduces a supply-chain risk — a compromised CDN could inject malicious scripts into the dashboard.
**AC:** Use Tailwind CLI or PostCSS at build time to generate a minimal CSS file embedded in the HTML. Update README to reflect actual behavior.

### TD-06: Client fetch paths don't validate HTTP status
**File:** `src/dashboard.ts:122-130` — `res.json()` without `res.ok` checks
Non-2xx responses are treated as JSON and surface as opaque runtime errors. No actionable error states shown to user.
**AC:** All client fetch helpers check `res.ok`, emit actionable error states, and include response details for debugging.

### TD-07: Server-side error handling swallows details
**File:** `src/handler.ts:48-51`
The `.catch()` for event metrics returns a generic 500 with no logging or error detail. No way to distinguish "event not found" vs "Redis down".
**AC:** Differentiate error types (404 for unknown event, 500 for internal errors). Include error context in responses. Optionally log the error.

### TD-08: No security headers on responses `[SEC]`
**File:** `src/handler.ts`
HTML and JSON responses have no `Content-Security-Policy`, `X-Content-Type-Options`, or `X-Frame-Options` headers. CDN script tag would violate strict CSP. **Security note:** Missing security headers leave the dashboard vulnerable to clickjacking, MIME-type sniffing attacks, and script injection via framing.
**AC:** Add basic security headers. Moving off CDN Tailwind (TD-05) is a prerequisite for strict CSP.

### IMP-01: Harden handler URL normalization and routing
Refactor handler to parse pathname/query safely and match API routes against normalized path segments. Prevents subtle mount-path bugs across Express/Fastify/raw HTTP setups.
**AC:** Root, API routes, nested base paths, and query-string requests are covered by tests and behave consistently.

### IMP-02: Add test pyramid for UI package
Unit tests for `createDashboardHandler` plus Playwright smoke tests for dashboard navigation/theme toggle/workflow diagram rendering.
**AC:** CI runs UI tests and catches route/render regressions before publish.

### FEAT-01: Built-in auth integration hooks `[SEC]`
Extend `createDashboardHandler` options with `authorize(req)` callback or adapter-specific wrapper helpers. Unauthorized requests receive 401/403; authorized traffic works unchanged. **Security note:** Direct fix for TD-02. Without this, any deployment that exposes the dashboard route leaks operational data.

### FEAT-02: Live updates mode (SSE / polling)
Add auto-refresh interval (short polling first, optionally SSE) with pause/resume control. Metrics and list views update automatically without full page reload. Load impact is configurable.

### FEAT-03: Event history timeline
Event detail page currently only shows aggregate counts. Add a timeline or recent executions list showing individual event instances with timestamps and statuses.

### FEAT-04: Workflow execution insights
Show recent workflow runs with status (in progress, completed, failed), duration, current step. Add step-level counters (success/failure/retry) and failure highlights in workflow detail view.

---

## P2 - Medium

### TD-09: Accessibility and keyboard navigation gaps
**File:** `src/dashboard.ts:295`, `:334` use `onclick` on `<tr>`; back nav uses `<a>` without `href` at `:209`, `:515`
Clickable table rows and hash navigation rely on mouse interactions. No ARIA labels, roles, or keyboard navigation support. Tables lack `scope` attributes. Theme toggle has no accessible label.
**AC:** Interactive elements are keyboard-focusable (`button`/`a href`), include ARIA labels, and pass basic a11y checks.

### TD-10: Global mutable state in client JS
**File:** `src/dashboard.ts:117-119`
`cachedIntrospection`, `eventsPage`, `workflowsPage` are global mutable variables. Pagination state lost on navigation and not reflected in URL.
**AC:** Encode pagination in URL hash (e.g., `#/?ep=2&wp=1`) or use a simple state object so browser navigation works correctly and state survives refresh.

### IMP-03: Self-host and purge CSS
Replace CDN Tailwind with build-time CSS generation. Embed purged CSS inline in HTML. Reduces payload from ~300KB+ to a few KB and removes external dependency.
**AC:** Dashboard renders offline with minimal CSS payload.

### IMP-04: Improve failure UX and observability
Standardize client-side error component with status/message. Add skeleton loaders or spinners for loading states. Show actionable error messages with retry buttons.
**AC:** Dashboard exposes meaningful error context instead of generic messages.

### IMP-05: URL-driven routing for pagination
Encode pagination state in the hash (`#/?ep=1&wp=0`) so browser navigation works correctly and page state survives refresh.
**AC:** Back/forward navigation restores pagination. Shareable URLs include page state.

### IMP-06: Configurable pagination and density controls
Current fixed page size (5) is too limited for larger installations. Add `PAGE_SIZE` control with `localStorage` persistence.
**AC:** Users can change page size without code changes and preference persists between sessions.

### IMP-07: Add CORS configuration option `[SEC]`
Add optional `cors` config to `DashboardOptions` for API routes so the dashboard can be embedded in different origins or fetched from external tools. **Security note:** Without explicit CORS configuration, misconfigurations could allow unintended cross-origin access to operational APIs.
**AC:** CORS headers are configurable and applied to API responses.

### FEAT-05: Event search and filtering
Add search bar to filter events by type name. Client-side search box + filters (retry enabled, callback presence, branch count) with URL/hash state sync.

### FEAT-06: Workflow step execution status in flow diagram
Color-code flow diagram nodes based on real-time step execution status (idle, running, succeeded, failed). Currently the diagram is purely structural.

### FEAT-07: Metrics aggregation (rates, latency, charts)
Show event throughput (events/min), average processing latency, and failure rates over time. Add lightweight sparkline/time-window charts if backend exposes timeseries endpoint.

### FEAT-08: Manual retry trigger
Allow triggering a retry for failed events directly from the dashboard via a POST endpoint.

### FEAT-09: Dashboard authentication middleware `[SEC]`
Add optional basic auth or token-based auth middleware option to protect the dashboard in production environments. **Security note:** Complementary to FEAT-01 for environments that prefer middleware-based auth over callback hooks.

---

## P3 - Low / Nice-to-have

### TD-12: Inconsistent variable declarations
**File:** `src/dashboard.ts` inline JS
Mixes `var` (lines 118-119, 218-223) with `let/const` (lines 117, 263-265).
**AC:** Use `const/let` throughout.

### TD-13: Stale cached introspection in detail views
**File:** `src/dashboard.ts:117`, `:172`, `:191` — only refresh when cache is null
Detail refreshes reuse stale introspection and may show outdated metadata until full dashboard refresh.
**AC:** Detail refresh path can optionally force metadata refresh (or cache with TTL/invalidation).

### IMP-08: Responsive layout for mobile
Current layout uses `max-w-[1200px]` and fixed grid columns. Tables overflow on small screens.
**AC:** Add responsive breakpoints for table layouts (stack on mobile) and stat card grids.

### IMP-09: Resize handling for flow diagram SVG
`drawFlowConnections()` only runs on render and theme toggle. Window resize breaks SVG arrow positions.
**AC:** Add a debounced `resize` event listener that redraws connections.

### IMP-10: Add ETag / caching headers for API responses
Introspection endpoint returns relatively static data. Adding `Cache-Control` or `ETag` headers reduces redundant fetches.
**AC:** API responses include appropriate caching headers.

### IMP-11: Add build-time HTML compression
HTML string is ~25KB uncompressed. Minifying embedded JS/CSS at build time reduces served payload.
**AC:** Build step produces minified HTML output.

### IMP-12: Align README with real behavior
Reduces onboarding friction and deployment mistakes. Update docs for CDN dependency, security, recommended auth setup, and known limits.
**AC:** README reflects current behavior and includes a production checklist section.

### FEAT-10: Data export (JSON/CSV)
Add export buttons to tables for downloading event and workflow data. One-click export produces structured snapshot usable for debugging/support workflows. Redact configurable sensitive fields.

### FEAT-11: Customizable theme/branding
Extend `DashboardOptions` to accept custom colors, logo, and title so users can brand the dashboard for their application.

---

## Security Summary

| Item | Risk | Description |
|------|------|-------------|
| TD-02 | Critical | Dashboard exposed without authentication — leaks architecture and metrics |
| TD-11 | Critical | String concatenation rendering — XSS if `esc()` is missed on any field |
| TD-01 | High | Fragile URL parsing — route confusion / path traversal risk |
| TD-05 | High | CDN dependency — supply-chain attack vector for script injection |
| TD-08 | High | Missing security headers — clickjacking, MIME sniffing, framing attacks |
| FEAT-01 | High | Auth hooks — direct mitigation for TD-02 |
| IMP-07 | Medium | No CORS config — potential cross-origin data leakage |
| FEAT-09 | Medium | Auth middleware — complementary protection layer |
