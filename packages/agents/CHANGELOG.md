# Changelog

All notable changes to this project will be documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-03-13

### Changed

- Bumped `@synkro/core` peer dependency from `^0.18.1` to `^0.19.0`.

## [0.3.0] - 2026-03-11

### Added

- **Observability (D4)** — Agents can now emit structured lifecycle events into the synkro event system. Enable with `emitEvents: true` in `AgentConfig`. Emitted events: `agent:run:started`, `agent:run:completed`, `agent:run:failed`, `agent:tool:executed`. Events are no-ops in standalone mode (no synkro context).
- **Dynamic Router (D5)** — `createRouter()` provides LLM-based N-path workflow branching. The router presents named routes to the LLM (JSON mode, temperature 0), selects the best route, and publishes the selected route name as a synkro event with the current payload. Supports a configurable `fallback` route for uncertain cases.
- **Supervisor/Worker Pattern (D6)** — `createSupervisor()` creates an agent that delegates tasks to specialized worker agents via a synthetic `delegate_to_worker` tool. The supervisor iterates (reason → delegate → observe) until the task is complete. `maxRounds` defaults to 5 and maps directly to the underlying agent's `maxIterations`. Built entirely on existing Agent primitives.

## [0.2.1] - 2026-03-11

### Changed

- Bumped `@synkro/core` peer dependency from `^0.18.0` to `^0.18.1`.

## [0.2.0] - 2026-03-11

### Added

- **Live Agent Context** — Tools receive real `publish()` and `setPayload()` from the synkro handler context when running via `asHandler()`. Standalone `agent.run()` keeps safe no-op stubs.
- **Agent Registry** — `AgentRegistry` class for registering and looking up agents by name. Enables cross-agent delegation via `ctx.delegate(agentName, input)` in tool functions.
- **Delegation with token tracking** — Delegated agent runs accumulate token usage into the parent agent's budget, preventing runaway spending across agent chains.
- **Agent Pipeline** — `createPipeline()` generates a `SynkroWorkflow` from a sequence of agent steps. Supports custom `inputMapper` functions, string-based agent resolution from registry, and workflow-level `onSuccess`/`onFailure`/`onComplete` branching.
- **Factory function** — `createAgentRegistry()` for ergonomic registry creation.

## [0.1.0] - 2026-03-11

### Added

- **Agent class** with ReAct loop (reason → act → observe → repeat).
- **ModelProvider interface** with built-in adapters for OpenAI, Anthropic, and Gemini.
- **Tool system** — typed tools with JSON Schema parameters, parallel execution, error handling.
- **ConversationMemory** — Redis-backed message history via `TransportManager`.
- **`agent.asHandler()`** — bridges agents into Synkro's event system (locking, dedup, retries, DLQ).
- **Safety guardrails** — `maxIterations` and `tokenBudget` prevent runaway loops and API spend.
- **Factory functions** — `createAgent()` and `createTool()` for ergonomic API.
