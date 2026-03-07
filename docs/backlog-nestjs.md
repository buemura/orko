# Synkro Backlog — Technical Debt, Improvements & Features

> Merged analysis of `@synkro/core`, `@synkro/nestjs`, `@synkro/next`, and `@synkro/ui` packages.
> Sources: Claude and Codex analyses. Date: 2026-03-06

Items are organized by priority (P0 > P1 > P2 > P3). Security-sensitive items are tagged with `[SEC]`.

---

## P0 - Critical

### ~~TD-01: `logger.warn` silenced in production~~ DONE
**Package:** `@synkro/core` — `packages/core/src/logger.ts`
~~`logger.warn` is gated behind the same `debugEnabled` flag as `logger.debug`. Handler retry warnings, step-mismatch warnings, and missing chained workflow errors are all invisible unless `debug: true` is explicitly set.~~
**Resolution:** Removed the `debugEnabled` guard from `warn`. Warnings now always emit, matching `error` behavior. Released in `v0.9.0`.

### TD-02: `publishMessage` discards Redis promise — silent fire-and-forget
**Package:** `@synkro/core` — `packages/core/src/transport/redis.ts:27`
`ioredis.publish()` returns a `Promise<number>` that is never awaited or caught. If Redis is temporarily unavailable, errors are silently swallowed. This affects every event publish and every workflow step transition. The `TransportManager` interface declares `publishMessage` as `void`, which forces this silent discard.
**Fix:** Add `.catch()` error handling in `RedisManager.publishMessage`, or change the interface to return `Promise<void>`.

### ~~TD-03: Noop handler injection masks missing `@OnWorkflowStep` in NestJS `[SEC]`~~ ✅ Resolved in v0.5.0
Removed the noop pre-fill pattern. The module now validates that every workflow step has a handler (inline or via `@OnWorkflowStep` decorator) and throws a descriptive error at startup if any step is missing.

### TD-04: `processingLocks` is in-process memory — no distributed locking `[SEC]`
**Package:** `@synkro/core` — `packages/core/src/handlers/handler-registry.ts`
`processingLocks` is a `Set<string>` in process memory. In multi-instance deployments (multiple pods), Redis Pub/Sub delivers to all subscribers, so the same `requestId:eventType` message can be processed in parallel across instances. The lock provides no cross-instance protection. **Security note:** Duplicate processing can lead to repeated side effects (double charges, duplicate notifications, replay-style vulnerabilities).
**Fix:** Implement distributed locking via Redis `SET NX EX` or use Redis Streams (with consumer groups) instead of Pub/Sub.

### TD-05: `withLock` has TOCTOU gap under concurrent step completions `[SEC]`
**Package:** `@synkro/core` — `packages/core/src/workflows/workflow-registry.ts:28-46`
Multiple concurrent callers can pass the `!this.locks.has(lockKey)` check before either sets the lock. When a pending promise resolves and multiple waiters resume, they all pass `has()` simultaneously and proceed to execute. **Security note:** Race condition can cause workflow steps to execute multiple times, bypassing intended exactly-once semantics.
**Fix:** Replace with a queue-based mutex pattern.

---

## P1 - High

### ~~TD-06: No guard when service lifecycle fails before `onModuleDestroy`~~ ✅ Resolved in v0.5.0
`onModuleDestroy` now guards against uninitialized `synkro` instance — safe when init partially fails.

### ~~TD-07: Runtime methods called before initialization~~ ✅ Resolved in v0.5.0
All public methods (`publish`, `on`, `introspect`, `getEventMetrics`, `getInstance`) now throw a descriptive error if called before the module has completed initialization.

### TD-08: Duplicate decorator registrations are not validated
**Package:** `@synkro/nestjs` — `packages/nestjs/src/synkro.service.ts`
Two providers can bind the same workflow step; first match wins implicitly and behavior becomes non-deterministic via `.find(...)` for step binding with no duplicate detection in explorer.
**Fix:** Startup detects duplicate `workflowName + stepType` bindings and throws with provider/method details.

### TD-11: Three Redis connections per instance, hardcoded
**Package:** `@synkro/core` — `packages/core/src/transport/redis.ts`
`RedisManager` unconditionally opens publisher, subscriber, and cache clients. No option to share connections, use Redis Cluster, or configure connection options (timeouts, retry strategy, TLS).
**Fix:** Accept `RedisOptions` or allow passing existing `ioredis` instances.

### IMP-01: Structured logging with correlation IDs
Replace the minimal custom logger with structured JSON logging (e.g., `pino`). Include `requestId` in every log line for request tracing. Support configurable log levels independently from debug mode.

### IMP-02: Payload schema validation hooks `[SEC]`
Payloads are typed as `unknown` and cast via `as` in handlers. Add an optional schema validation hook per event/step (compatible with `zod`, `class-validator`, or any validator). **Security note:** Unvalidated payloads can carry injection vectors through the system if handlers pass data to databases, templates, or shell commands.
**Fix:** This prevents runtime type errors and provides clear error messages at the boundary.

### ~~IMP-03: Align NestJS adapter semantics with `@synkro/core`~~ ✅ Resolved in v0.5.0
Removed implicit noop fallback. The NestJS adapter now fails fast on missing step handlers, matching core behavior. Added `retention` passthrough for core v0.13.0 parity.

### ~~IMP-04: Expand public service API parity~~ ✅ Resolved in v0.5.0
`SynkroService` now exposes `introspect()` and `getEventMetrics(eventType)` methods directly, matching core's public API.

### IMP-08: Dashboard authentication support `[SEC]`
The dashboard handler exposes `/api/introspection` and `/api/events/:type` with zero authentication. **Security note:** Operational metadata (event names, workflow topology, metrics) is accessible to anyone who can reach the endpoint. This leaks internal system architecture.
**Fix:** Add optional auth hooks to `DashboardHandlerOptions` (e.g., `authenticate?: (req) => boolean`, or support for API keys / HTTP basic auth).

### FEAT-01: Redis Streams support (message durability)
Redis Pub/Sub is fire-and-forget. If the process restarts mid-workflow, messages are lost and workflows stall indefinitely with `status: "running"` and no recovery mechanism. Implement Redis Streams with consumer groups for durable, at-least-once delivery and dead-letter handling.

### FEAT-02: Workflow recovery / resumption
When a workflow's state persists in Redis but its in-flight step message was lost (restart, network partition), there is no mechanism to detect and re-enqueue stalled workflows. Add a recovery loop that scans for `status: "running"` states and re-publishes the current step.

### FEAT-03: Distributed locking via Redis `[SEC]`
Replace in-process `Set`-based locking with Redis-based distributed locks (`SET NX EX` or Redlock) to support multi-instance deployments safely. **Security note:** Directly addresses TD-04 and TD-05 race conditions that allow duplicate processing.

### FEAT-04: Multi-instance Synkro support in one Nest app
Cannot currently isolate domains/tenants/transports in same process. Add named module registration (`forRoot({ name })`) and `@InjectSynkro(name)` token helper. Two independent Synkro instances should be able to run concurrently with separate workflows/transports.

### FEAT-05: Health/readiness integration
No first-class way to surface transport connectivity/handler readiness. Provide `SynkroHealthIndicator` (Terminus-friendly) exposing transport + bootstrap state. Health endpoint should report `up/down` with actionable metadata.

---

## P2 - Medium

### TD-09: Workflow state TTL hardcoded at 24 hours
**Package:** `@synkro/core` — `packages/core/src/workflows/workflow-registry.ts`
`setCache` is called with a fixed `86400` second TTL. Long-running workflows (>24h) will lose state. There is no way to configure TTL per workflow.
**Fix:** Add a `stateTtlSeconds` option to `WorkflowDefinition` with a sensible default.

### TD-10: Metric keys never expire in Redis
**Package:** `@synkro/core` — `packages/core/src/handlers/handler-registry.ts`
`synkro:metrics:*` keys have no TTL. In long-running systems with many distinct event types, metric keys accumulate indefinitely.
**Fix:** Add configurable TTL for metric keys, or implement periodic cleanup.

### TD-12: Test suite relies on `setTimeout` waits
**Package:** `@synkro/nestjs` — `packages/nestjs/src/synkro.module.test.ts`
Time-based waits (50ms/200ms sleeps) create flaky CI and slow execution.
**Fix:** Replace sleeps with deterministic synchronization helpers/event probes; remove magic delays.

### TD-13: No negative-path tests for initialization/config errors
**Package:** `@synkro/nestjs`
Core startup failure behavior is not locked by tests. No tests for invalid redis config, duplicate handlers, or missing workflow handlers.
**Fix:** Add tests for expected boot failures and error messaging paths.

### IMP-05: Improve NestJS module type safety
**Package:** `@synkro/nestjs` — `packages/nestjs/src/synkro.interfaces.ts:26-32`
`SynkroModuleAsyncOptions` uses `any[]` for `imports` and `inject`. Use `Type<any>[]` or `ModuleMetadata['imports']` for `imports` and `FactoryProvider['inject']`-style types for `inject`.

### IMP-06: Better diagnostics during discovery/registration
Hard to debug missing/duplicate handlers in large modules. Add optional debug logs summarizing discovered event/workflow handlers and collisions. Unify or clearly document the `@OnEvent` and `@OnWorkflowStep` decorators that exist in both `@synkro/core` (TC39 decorators with `Symbol.for`) and `@synkro/nestjs` (NestJS `SetMetadata`). These are not interchangeable — a NestJS user importing from `@synkro/core` by mistake gets silently ignored handlers. When `debug: true`, startup should log handler counts and conflicts with clear IDs.

### IMP-07: Improve `forRootAsync` ergonomics
Missing common Nest dynamic-module options limits adoption. Support `extraProviders`, `global` override, and optional named instance tokening. Module options should mirror common Nest patterns and support multi-instance scenarios.

### IMP-09: Strengthen README and examples around production usage
Current docs focus on happy path only. Add sections for lifecycle/readiness, error handling, retries/idempotency, and transport tradeoffs. Include operational guidance and a troubleshooting section.

### IMP-10: Add `@synkro/ui` test coverage
`packages/ui` has no tests. The dashboard HTML is 640+ lines of inline JavaScript with no coverage. Add tests for the Node.js HTTP handler routing and response content.

### IMP-11: Add `InMemoryManager` test coverage
Only `RedisManager` is tested directly. Add dedicated unit tests for `InMemoryManager` to verify pub/sub, cache, and TTL behavior.

### IMP-12: E2E tests against real Redis
All Redis tests mock ioredis. Add integration tests that run against a real Redis instance (via Docker in CI) to catch connection, serialization, and pub/sub timing issues.

### FEAT-06: Configurable retry strategy per event/step
Currently retry is a simple count with fixed behavior. Support configurable retry strategies: exponential backoff, fixed delay, custom delay functions, and dead-letter routing after max retries.

### FEAT-07: Observability hooks (OpenTelemetry)
Add optional OpenTelemetry integration for tracing workflow execution spans, step durations, and error rates. Emit spans/metrics around publish, handler execution, retries, and workflow transitions. Instrumentation should be enabled with minimal config.

### FEAT-08: Dashboard — workflow execution history
The dashboard currently shows registered events/workflows and counters. Add a view for active and completed workflow executions with step-by-step status, timestamps, and error details.

### FEAT-09: Fastify-safe dashboard integration helper
Example assumes Express internals and is not adapter-agnostic. Add helper utility for mounting dashboard for both Express and Fastify adapters.

### FEAT-10: Typed decorators and publish API (generics)
Event/payload strings are untyped and error-prone at scale. Introduce optional event map generic (`EventName -> Payload`) for `OnEvent`, `OnWorkflowStep`, and `publish`. Consumers can opt into compile-time event/payload type checking without breaking existing API.

### FEAT-11: Runtime handler registration for workflow steps
Dynamic modules/plugins may need late binding after app boot. Add `registerWorkflowStepHandler(workflow, step, handler)` on `SynkroService`. Handlers can be added at runtime and validated for duplicates.

### FEAT-12: Graceful shutdown with in-flight draining
`stop()` disconnects Redis clients immediately. Add graceful shutdown that waits for in-flight handlers to complete (with a configurable timeout) before disconnecting.

---

## P3 - Low / Nice-to-have

### TD-14: `InMemoryManager.setCache` silently ignores TTL
**Package:** `@synkro/core` — `packages/core/src/transport/in-memory.ts:39`
The `_ttlSeconds` parameter is accepted but unused. Workflow state saved with a 24h TTL never expires in memory, causing behavior divergence from Redis and potential memory leaks in long-running test scenarios.
**Fix:** Implement `setTimeout`-based TTL for in-memory cache, or document the divergence.

### TD-15: Handler overwrite is silent
**Package:** `@synkro/core` — `packages/core/src/handlers/handler-registry.ts:57`
Calling `register()` twice with the same `eventType` silently overwrites the first handler. No warning is logged for accidental double-registration.
**Fix:** Add a `logger.warn` when overwriting an existing handler.

### TD-16: Duplicate `subscribe` calls for re-registered events
**Package:** `@synkro/core` — `packages/core/src/transport/redis.ts:30-46`
`subscribeToChannel` always calls `subscriber.subscribe(channel)` regardless of whether the channel is already subscribed. While ioredis treats this as a no-op, it's unnecessary and the `channelCallbacks` Map silently overwrites the previous callback.
**Fix:** Guard with `if (!this.channelCallbacks.has(channel))` before subscribing.

### TD-17: `SynkroOptions.transport` is type-required but runtime-optional `[SEC]`
**Package:** `@synkro/core` — `packages/core/src/types.ts:28`, `packages/core/src/synkro.ts:38-45`
If `transport` is omitted, the code falls through to the Redis branch silently. The error only surfaces if `connectionUrl` is also missing, producing a confusing message. **Security note:** Silent fallback to a networked transport could unintentionally expose events to a shared Redis bus.
**Fix:** Add explicit validation for the `transport` field, or make it optional with a documented default.

### TD-18: Explorer uses broad `Record<string, any>` casts
**Package:** `@synkro/nestjs` — `packages/nestjs/src/synkro.explorer.ts`
Type safety is lost around method extraction and binding.
**Fix:** Narrow method extraction typing to avoid `any` where practical.

### IMP-13: Add ESLint / linting to CI
No ESLint configuration exists at the root level. The CI pipeline runs `test`, `build`, and `type-check` but has no lint step. Add consistent linting rules across all packages.

### IMP-14: Clean up legacy example code
`examples/core/src/` contains its own `event-manager.ts` that appears to predate the current architecture. This could confuse contributors. Update or remove it.

### IMP-15: Add version-compatibility matrix
Consumers need explicit tested combinations across Nest versions. Document/test matrix for Nest 10/11 and Node versions in CI/docs.

### FEAT-13: Redis Cluster / Sentinel support
`RedisManager` uses bare `new Redis(url)` with no support for Redis Cluster or Sentinel. Add configuration options for high-availability Redis deployments.

### FEAT-14: Event payload versioning
As the system evolves, event payloads change. Add optional payload versioning support so handlers can migrate or reject incompatible payload versions.

### FEAT-15: Middleware / interceptor hooks
Add a middleware/interceptor pipeline for events (e.g., logging, metrics, validation, transformation) that runs before/after handler execution, similar to NestJS interceptors but at the Synkro level.

---

## Security Summary

| Item | Risk | Description |
|------|------|-------------|
| ~~TD-03~~ | ~~Critical~~ | ~~Noop handler silently skips workflow steps~~ ✅ Resolved in v0.5.0 |
| TD-04 | Critical | In-process-only locks — duplicate processing across instances (replay risk) |
| TD-05 | Critical | TOCTOU race in `withLock` — concurrent step execution bypasses mutex |
| IMP-02 | High | No payload validation — injection vectors propagate through handlers |
| IMP-08 | High | Dashboard exposed without auth — leaks internal architecture metadata |
| FEAT-03 | High | No distributed locking — direct fix for TD-04/TD-05 |
| TD-17 | Low | Silent fallback to Redis transport — unintended event exposure |
