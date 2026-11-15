# Phase 3: Step-down - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

An empty shelf still returns a Claude success from the next lower class, and the user sees one notice until that class is live again.

Success criteria (from ROADMAP):
1. User requests a class with no live triple and still gets a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent.
2. User sees one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, the reason, and that auto mode will not receive Anthropic `safeguards` from a non-Anthropic provider. The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names.
3. User receives an error from Claude only when all four classes have no live triple. A live model on a lower class does not surface as "All target providers failed".

Requirements: FALL-01, FALL-02, FALL-03. Depends on Phase 2. UI hint: yes (management UI notice).

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Locked constraints that carry over from PROJECT.md and phases 1-2:
- Class-switch code lives in `packages/core/src/class-switch/`; parent files get only the seam calls in `.planning/research/FORK-SEAMS.md`.
- The response body keeps the model name Claude sent (Claude identity constraint).
- Policy input stays scalars-only (model name, tool list, image flag, token estimate, tool-turn flag, session id) — never the message body.
- Anthropic `safeguards` is not invented for auto mode on a non-Anthropic provider — the notice names the fact instead.
- Phase-2 prohibition still holds: an empty shelf in a HIGHER class must not be answered by a lower class in the phase-2 code path — Phase 3 introduces the step-down deliberately behind its own gate.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
