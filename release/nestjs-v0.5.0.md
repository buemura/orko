# @synkro/nestjs v0.5.0

**Release date:** 2026-03-07

## Changes

### IMP-03: Align NestJS adapter with @synkro/core v0.13.0

The NestJS module now supports all core v0.13.0 features and aligns its behavior with the core package.

**New `retention` option:** Configure Redis key TTLs directly through the module options:

```typescript
SynkroModule.forRoot({
  transport: "redis",
  connectionUrl: "redis://localhost:6379",
  retention: {
    lockTtl: 60,
    dedupTtl: 3600,
    stateTtl: 7200,
    metricsTtl: 86400,
  },
});
```

**Peer dependency** updated from `@synkro/core ^0.9.0` to `^0.13.0`.

### IMP-04: Expand public service API

`SynkroService` now exposes `introspect()` and `getEventMetrics(eventType)` methods directly, so users no longer need `getInstance()` to access core introspection and metrics.

### TD-03: Remove noop handler masking [SEC]

**Breaking:** Workflow steps without a handler (inline or via `@OnWorkflowStep` decorator) now throw a descriptive error at startup instead of silently running a noop. This prevents auth/validation steps from being accidentally bypassed.

If you relied on noop-filled steps, add the corresponding `@OnWorkflowStep` decorators or provide inline `handler` functions.

### TD-06: Safe module destroy on partial init

`onModuleDestroy` now guards against uninitialized state — if `onModuleInit` fails, the destroy lifecycle no longer throws on the uninitialized `synkro` instance.

### TD-07: Readiness checks on public methods

All public methods (`publish`, `on`, `introspect`, `getEventMetrics`, `getInstance`) now throw a clear error if called before the module has completed initialization.
