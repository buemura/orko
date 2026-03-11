# Changelog

All notable changes to this project will be documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-11

### Added

- **Agent class** with ReAct loop (reason → act → observe → repeat).
- **ModelProvider interface** with built-in adapters for OpenAI, Anthropic, and Gemini.
- **Tool system** — typed tools with JSON Schema parameters, parallel execution, error handling.
- **ConversationMemory** — Redis-backed message history via `TransportManager`.
- **`agent.asHandler()`** — bridges agents into Synkro's event system (locking, dedup, retries, DLQ).
- **Safety guardrails** — `maxIterations` and `tokenBudget` prevent runaway loops and API spend.
- **Factory functions** — `createAgent()` and `createTool()` for ergonomic API.
