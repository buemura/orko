# Changelog

All notable changes to this project will be documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-03-09

### Added

- **Serverless HTTP dispatch** (FT-08): Full event and workflow processing in Next.js serverless functions. New exports: `createSynkroServerless(options)`, `createEventHandler(synkro, options)`, `createWorkflowStepHandler(synkro, options)`, `HttpTransportManager` (Redis for cache, HTTP POST for dispatch, optional HMAC signing), and `WorkflowAdvancer`.
- **`publishAfterResponse()` helper** (FT-09): Wraps Next.js 15+ `after()` API for fire-and-forget event publishing after the response is sent.
- **Align SynkroClient with core v0.15.0** (IMP-05): Added `off(eventType, handler?)`, `getWorkflowState(requestId, workflowName)`, and `cancelWorkflow(requestId, workflowName)` to `SynkroClient`.

### Changed

- **Peer dependency** updated from `@synkro/core ^0.9.0` to `^0.15.0`. Added `ioredis: ^5.0.0` as optional peer dependency (required for serverless mode).
