# Phase 3 — API Coverage

**Detector result:** `detected: true` from one lexical signal (`new UI API` in an acceptance criterion). Manual scope review confirms that this phrase does not introduce an integration.

**Declaration:** No external API integration: Phase 3 changes the existing provider request pipeline and existing internal management transports; it adds no new external provider endpoint, SDK, OAuth flow, webhook, or MCP integration.

## Coverage Matrix

| Surface | Decision | Reason |
|---------|----------|--------|
| Existing provider `/v1/messages` request and response path | INTEGRATE | Plan 03-01 extends the existing `GatewayRequestPipeline` and ordered class-switch attempt list. It reuses the phase-1/2 provider calls and stubs `fetch` in tests; it adds no provider endpoint. |
| Existing OpenRouter catalog and benchmark data | INTEGRATE | Existing phase-1/2 shelf rows and filters are inputs to `attemptsForStepDown`. Phase 3 adds no OpenRouter request, refresh, SDK, or credential path. |
| Internal `POST /api/ccr/rpc` method `getSwapNotice` | OPT-OUT | This is CCR's existing authenticated management transport, not an external API integration. Plan 03-02 adds one read-only method inside the current dispatcher and preserves HTTP 401 behavior. |
| Electron `window.ccr` / `ccr:app:get-swap-notice` | OPT-OUT | This is the existing in-process desktop bridge, not an external service. Plan 03-02 uses the same notice read as web RPC. |
| UI acceptance wording `new UI API` | OPT-OUT | The detector matched prose that prohibits an unnecessary additional UI surface. The implementation adds only the approved `SwapNoticeBanner`, existing-poll state, SD pill, and expanded detail markup. |
| npm packages and registries | OPT-OUT | RESEARCH.md requires no installation. The phase reuses Node.js, React, `lucide-react`, and `motion` already in the repository. |

No phase requirement remains without an INTEGRATE or OPT-OUT disposition.
