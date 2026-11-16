# Stack Research

**Domain:** Per-provider SOCKS5 dispatch in Claude Code Router (CCR), a Node.js/undici local model gateway  
**Researched:** 2026-11-16  
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | `>=22` (project constraint) | Runtime | Keep the milestone's existing supported runtime range. |
| `undici` | `7.29.0` currently locked; v7 docs checked at `7.30.1` | Existing fetch implementation and per-request dispatcher | The current v7 dependency already exports `ProxyAgent` and `Socks5ProxyAgent`. `ProxyAgent` routes `socks5:` and `socks:` through its SOCKS5 dispatcher, with username/password support and target hostnames sent to the proxy for DNS. No third-party transport dependency is required. The SOCKS implementation is marked experimental and emits an `ExperimentalWarning`. |
| Existing `fetchWithSystemProxy` dispatcher cache | Existing code | Per-proxy dispatcher reuse | Keep the current undici `Dispatcher` contract and cache. Normalize accepted `socks5h://` URLs to `socks5://` before constructing/caching `ProxyAgent`; Undici does not accept the `socks5h:` scheme itself. Both accepted config variants must use the domain-name SOCKS5 address path so DNS stays at the proxy. |

**Version note:** The project lockfile has `undici@7.29.0`; package manifests permit `^7.29.0`. Context7 includes v7.30.1 documentation, and the official v7.30.1 source exposes the SOCKS5 dispatcher. Registry metadata observed `undici@7.30.1` as the current v7 release, but that version-current claim is LOW confidence from the research seam; confirm with the lockfile/registry during implementation. The stack decision does not require a version bump: the v7.29.0 source tree also contains `Socks5ProxyAgent` and `ProxyAgent` SOCKS routing. Prefer a tested v7 patch update only for normal maintenance, not as a new library requirement.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `socks-proxy-agent` | `10.1.0` observed; LOW confidence for current version | Node `http.Agent` / `https.Agent` support for SOCKS | Do **not** add for CCR's fetch path. It implements Node's classic Agent API, not undici's `Dispatcher`; it cannot be passed to `fetch(..., { dispatcher })`. Its supported `socks5h` scheme does not make it undici-compatible. |
| `socks` | `2.8.10` observed; LOW confidence for current version | Raw SOCKS4/5 connection client | Only use if CCR must build its own undici connector (for example, if native Undici SOCKS support is rejected). `SocksClient.createConnection` returns a raw socket and accepts a hostname target plus SOCKS5 username/password; a hostname is encoded as a SOCKS domain name, so resolution occurs at the proxy. It is unnecessary for the recommended native path. |
| `fetch-socks` | `1.3.3` observed; LOW confidence for current version | Existing third-party undici SOCKS connector/Agent wrapper | Do not add. Its README explicitly marks the package deprecated and directs users to Undici's built-in `Socks5ProxyAgent`. |
| `undici-socks-proxy-agent` | Not found at the queried npm registry endpoint (404; LOW confidence) | — | Do not plan around this package name. Undici itself supplies the dispatcher. |

The current undici v7 SOCKS path is experimental. If that stability status is unacceptable, treat replacing it with a small, project-owned connector over `socks` as a deliberate fallback—not as the default. Do not add multiple SOCKS adapters pre-emptively.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing undici `MockAgent` / dispatcher test seams | Verify per-request dispatch selection without live proxy traffic | Add tests for `socks5` and `socks5h` normalization, direct mode, credentials, and unchanged no-setting fallback. Include a local SOCKS5 integration test to prove that a hostname is sent for remote resolution and that HTTPS TLS remains end-to-end. |
| Package-lock and Node-version CI matrix | Guard compatibility | Keep CI at the project's supported Node `>=22` range. Do not adopt undici v8 solely for SOCKS: the v8.12.4 package metadata reports Node `>=22.19.0`, which would narrow the current runtime promise. That package version/engine claim is based on LOW-confidence registry metadata. |

## Installation

```bash
# Core
# No new dependency required. Keep the existing undici dependency.

# Optional, ordinary v7 patch refresh after compatibility tests
npm install -w packages/core undici@^7.30.1

# Dev dependencies
# No new dependency required.
```

The optional command is not necessary for SOCKS support. The current `^7.29.0` range already admits v7.30.x, while the committed lock currently fixes v7.29.0.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Existing undici v7 `ProxyAgent` with a canonicalized `socks5:` URI | `Socks5ProxyAgent` from undici directly | Use the explicit class if code clarity matters more than sharing the current `ProxyAgent(proxyUrl)` construction path. Both are undici `Dispatcher`s; both require `socks5:` or `socks:`, not `socks5h:`. |
| Native Undici SOCKS5 dispatcher | `socks` + custom undici `Agent({ connect })` connector | Use only if CCR opts out of Undici's experimental implementation or needs behavior it does not provide. Keep the SOCKS package at the socket layer; do not introduce a second HTTP client. |
| Node `>=22` plus existing undici v7 | Undici v8 (registry observed `8.12.4`, LOW confidence for current version) | Only if the project intentionally raises the runtime floor to `>=22.19.0` or later. v8 also exposes SOCKS5 dispatch, but it does not solve a capability missing from v7. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `socks-proxy-agent` as the fetch dispatcher | It implements Node `http.Agent`, not undici `Dispatcher`; using it would require changing HTTP stacks or writing an adapter around the wrong abstraction. | Undici's built-in `ProxyAgent` / `Socks5ProxyAgent`. |
| `fetch-socks` | Its current README says it is deprecated in favor of Undici's built-in SOCKS agent; it also adds a redundant connector/agent layer. | Existing Undici dispatcher. |
| A package named `undici-socks-proxy-agent` | The exact npm registry endpoint queried returned 404; there is no reason to add an unverified wrapper dependency. | Existing Undici dispatcher. |
| Full proxy-chain frameworks, proxy rotation, PAC, or chaining features | CCR needs one SOCKS5 hop selected per provider, not proxy orchestration. Extra features increase configuration and lifecycle surface. | One cached dispatcher per canonical proxy URL. |
| A second HTTP stack (`axios`, `got`, `node-fetch`, etc.) | It bypasses or duplicates the existing undici fetch path and complicates streaming, dispatcher selection, and fallback behavior. | Keep all provider-bound requests on the existing undici fetch path. |
| A hand-rolled SOCKS protocol implementation | Authentication, address encoding, timeouts, TLS, cleanup, and connection pooling are easy to get wrong. | Native Undici SOCKS support; raw `socks` only as the connector fallback. |

## Stack Patterns by Variant

**If the provider setting is `socks5://` or `socks5h://`:**
- Parse and validate the setting as SOCKS5, then translate `socks5h:` to `socks5:` for the Undici constructor.
- Pass the canonical URL to the same cached `ProxyAgent` path used by global proxies. Undici's URL grammar accepts `socks5:` and `socks:`; it does not accept `socks5h:`.
- Preserve username/password URL userinfo (or pass the values as Undici's `username`/`password` options). Encode credentials when serializing URLs. Do not include credential-bearing URLs in traces or logs.
- Treat both config schemes as remote-DNS SOCKS5. Undici's SOCKS client sends a domain target in the SOCKS request; it does not resolve that target locally first. Numeric-IP destinations remain IP addresses.

**If the provider setting is explicit `direct`:**
- Bypass all proxy dispatchers for that provider request. This is distinct from an absent setting, which must retain today's global/env/system behavior.
- Do not encode `direct` as an empty proxy URL or cache key.

**If Undici's experimental SOCKS dispatcher cannot be used:**
- Use `socks` only for `SocksClient.createConnection({ proxy: { type: 5, host, port, userId, password }, command: 'connect', destination: { host: opts.hostname, port: Number(opts.port) } })`.
- Return its raw socket through an undici `Agent({ connect })` connector. For HTTPS, layer target TLS over that SOCKS socket with `buildConnector({ ...requestTls })` and its `httpSocket` option; do not return an unencrypted SOCKS socket for an HTTPS origin.
- Preserve Undici's origin-based pooling and implement timeout, abort, error, and socket-destroy handling. Do not also create an HTTP client.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `undici@7.29.0` (currently locked) | Node `>=22` | v7's SOCKS5 dispatcher is present in the checked source and supports username/password. Use the canonical `socks5:` URI; normalize `socks5h:` at the config boundary. |
| `undici@7.30.1` (v7 docs checked; current release version observed with LOW confidence) | Node `>=20.18.1` per package metadata | Remains compatible with the project's Node floor; SOCKS feature status remains experimental. |
| `undici@8.12.4` (version observed with LOW confidence) | Node `>=22.19.0` per package metadata | Do not use without intentionally changing the declared runtime floor. v8 supports `socks5:`/`socks:`, not `socks5h:`, and retains the experimental SOCKS warning. |
| `socks-proxy-agent@10.1.0` (version observed with LOW confidence) | Node `>=20`; Node `http.Agent` API | Not compatible with undici's `dispatcher` option. |
| `socks@2.8.10` (version observed with LOW confidence) | Node `>=10`; raw socket API | Compatible as a low-level connector ingredient, not as a dispatcher or HTTP client. |

## Sources

- [Undici v7 ProxyAgent docs](https://github.com/nodejs/undici/blob/v7.30.1/docs/docs/api/ProxyAgent.md) — v7 `ProxyAgent` supports HTTP, HTTPS, and SOCKS5; Context7 documentation lookup (MEDIUM confidence).
- [Undici v7 Socks5ProxyAgent docs](https://github.com/nodejs/undici/blob/v7.30.1/docs/docs/api/Socks5ProxyAgent.md) — URL schemes, auth, per-request Dispatcher, experimental status, remote DNS; Context7 plus official source cross-check (MEDIUM confidence).
- [Undici v7 SOCKS5 source](https://github.com/nodejs/undici/blob/v7.30.1/lib/dispatcher/socks5-proxy-agent.js) — confirms SOCKS5 protocol validation, auth handling, hostname tunnel, TLS and exported Dispatcher. Source fetch classified LOW by the research seam; used as cross-check, not sole authority.
- [Undici Connector docs](https://github.com/nodejs/undici/blob/v7.30.1/docs/docs/api/Connector.md) — `buildConnector`, callback contract, and `httpSocket` for TLS over an existing socket (MEDIUM confidence via Context7).
- [socks-proxy-agent npm metadata](https://registry.npmjs.org/socks-proxy-agent/latest) — latest version and Node engine metadata observed as `10.1.0`; LOW confidence by the research seam.
- [socks npm metadata](https://registry.npmjs.org/socks/latest) — latest version observed as `2.8.10`; LOW confidence by the research seam.
- [socks package README](https://github.com/JoshGlazebrook/socks) — raw SOCKS5 CONNECT, remote hostname target, credentials, and raw socket API; LOW confidence by the research seam.
- [fetch-socks README](https://github.com/Kaciras/fetch-socks) — undici-compatible wrapper and explicit deprecation in favor of built-in Undici SOCKS; LOW confidence by the research seam.
- [Undici v7 package metadata](https://registry.npmjs.org/undici/7.30.1) and [Undici v8 package metadata](https://registry.npmjs.org/undici/8.12.4) — versions and Node engines; LOW confidence by the research seam.
- [Exact `undici-socks-proxy-agent` registry lookup](https://registry.npmjs.org/undici-socks-proxy-agent/latest) — returned 404 during research; LOW confidence.

---
*Stack research for: per-provider SOCKS5 dispatch in Claude Code Router*
*Researched: 2026-11-16*
