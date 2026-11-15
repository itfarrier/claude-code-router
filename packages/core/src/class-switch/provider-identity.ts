import type { GatewayProviderConfig } from "@ccr/core/contracts/app";

// The one Anthropic-identity predicate for the step-down notice and the UI
// request-log surfaces, so the banner and the log cannot drift. A provider
// counts as Anthropic only when its own `provider` (or, only when that field
// is absent, its explicit `type`) names Anthropic. An anthropic_messages
// protocol borrowed by a non-Anthropic provider stays false, and display
// names are never consulted. The protocol half of the old check
// (`normalizeProviderProtocol(identity) === "anthropic_messages"`) is pinned
// by the protocol table to true for the only accepted identity ("anthropic"),
// so the identity equality alone is equivalent; the unit tests keep the
// anthropic_messages-protocol negative control.
export function providerIdentityName(provider: GatewayProviderConfig): string {
  return provider.provider?.trim().toLowerCase() ?? provider.type?.trim().toLowerCase() ?? "";
}

export function safeguardsAppliesForIdentity(identity: string | undefined): boolean {
  return (identity ?? "").trim().toLowerCase() === "anthropic";
}

export function safeguardsAppliesForProvider(provider: GatewayProviderConfig): boolean {
  return safeguardsAppliesForIdentity(providerIdentityName(provider));
}
