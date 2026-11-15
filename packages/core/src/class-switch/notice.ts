import { loadAppConfig } from "@ccr/core/config/config";
import type { GatewayProviderConfig, SwapNotice, SwapNoticeClass } from "@ccr/core/contracts/app";
import {
  hasLiveTripleForClass,
  parseClassRequest,
  shelfClassForTarget
} from "@ccr/core/class-switch/plan";
import { normalizeProviderProtocol } from "@ccr/core/providers/runtime-topology";
import type { RouteModelRef } from "@ccr/core/routing/contracts";
import { modelRegistryForConfig, type ModelRegistry } from "@ccr/core/routing/model-registry";

// One process-local swap notice record (FALL-02). Process memory only: no disk
// persistence, no timer, and no cross-request shared step-down state. The
// latest successful swap wins; a read reconciles the saved requested class
// against class-level shelf/credential/bench liveness and clears the record
// when that class is live again.

export type StepDownSuccessInput = {
  requestedModel?: string;
  servedModel?: string;
  target: RouteModelRef | undefined;
  credentialLabel?: string;
  hadRequestedClassFailure: boolean;
};

let currentSwapNotice: SwapNotice | null = null;

const SHELF_CLASS_RANK: SwapNoticeClass[] = ["fable", "opus", "sonnet", "haiku"];

function isStrictlyLower(served: SwapNoticeClass, requested: SwapNoticeClass): boolean {
  return SHELF_CLASS_RANK.indexOf(served) > SHELF_CLASS_RANK.indexOf(requested);
}

function capitalClass(shelfClass: SwapNoticeClass): string {
  return shelfClass.charAt(0).toUpperCase() + shelfClass.slice(1);
}

// Actual Anthropic provider identity: the provider's own `provider` (or an
// explicit `type`) naming Anthropic. An anthropic_messages protocol borrowed by
// a non-Anthropic provider stays false — auto mode must not be told that a
// provider invents Anthropic safeguards.
function safeguardsAppliesFor(provider: GatewayProviderConfig): boolean {
  const identity = provider.provider?.trim().toLowerCase() ?? provider.type?.trim().toLowerCase() ?? "";
  return identity === "anthropic" && normalizeProviderProtocol(identity) === "anthropic_messages";
}

// Records an actual lower-class success. Returns the single stored record for a
// real step-down and null otherwise; nothing is stored for same-class or
// non-class successes. Only scalars cross this boundary: the parsed requested
// class, the target route, the model names, and a credential slug. Message
// bodies, provider keys, and provider error text never reach the notice.
export function recordStepDownSuccess(input: StepDownSuccessInput): SwapNotice | null {
  const requested = parseClassRequest(input.requestedModel);
  if (!requested) {
    return null;
  }
  if (input.target?.kind !== "provider") {
    return null;
  }
  const servedClass = shelfClassForTarget(input.target);
  if (!servedClass || !isStrictlyLower(servedClass, requested.shelfClass)) {
    return null;
  }
  const reason = input.hadRequestedClassFailure
    ? `all ${capitalClass(requested.shelfClass)} attempts refused before first token`
    : `no live ${capitalClass(requested.shelfClass)} triple`;
  return recordSwapNotice({
    credentialLabel: input.credentialLabel?.trim() || "none",
    model: input.target.model,
    provider: input.target.provider.name ?? "",
    reason,
    requestedClass: requested.shelfClass,
    safeguardsApplies: safeguardsAppliesFor(input.target.provider),
    servedClass,
    sinceAt: new Date().toISOString()
  });
}

export function recordSwapNotice(notice: SwapNotice): SwapNotice {
  currentSwapNotice = notice;
  return currentSwapNotice;
}

export async function readSwapNotice(options: { modelRegistry?: ModelRegistry } = {}): Promise<SwapNotice | null> {
  const record = currentSwapNotice;
  if (!record) {
    return null;
  }
  const registry = options.modelRegistry ?? modelRegistryForConfig(await loadAppConfig());
  // The config await above can let a newer swap replace the singleton. Only
  // the captured record may apply its own recovery decision: a replacement
  // stays untouched and is returned for its own reconciliation instead of
  // being cleared or judged by the stale record's class liveness.
  if (currentSwapNotice !== record) {
    return currentSwapNotice;
  }
  if (hasLiveTripleForClass(record.requestedClass, registry)) {
    currentSwapNotice = null;
    return null;
  }
  return record;
}

export function clearSwapNotice(): void {
  currentSwapNotice = null;
}
