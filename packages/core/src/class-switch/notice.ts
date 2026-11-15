import { loadAppConfig } from "@ccr/core/config/config";
import type { SwapNotice, SwapNoticeClass } from "@ccr/core/contracts/app";
import { hasLiveTripleForClass, parseClassRequest } from "@ccr/core/class-switch/plan";
import { safeguardsAppliesForIdentity } from "@ccr/core/class-switch/provider-identity";
import { modelRegistryForConfig, type ModelRegistry } from "@ccr/core/routing/model-registry";

// One process-local swap notice record (FALL-02). Process memory only: no disk
// persistence, no timer, and no cross-request shared step-down state. The
// latest successful swap wins; a read reconciles the saved requested class
// against class-level shelf/credential/bench liveness and clears the record
// when that class is live again.

// Scalar-only boundary (WR-05): every field is a string, boolean, or class
// name derived before the call. No provider config object, route reference,
// or message body can enter the notice through this input, so no provider
// credential secret has a path into notice state.
export type StepDownSuccessInput = {
  credentialLabel?: string;
  hadRequestedClassFailure: boolean;
  model: string;
  provider: string;
  providerIdentity?: string;
  requestedModel?: string;
  servedClass: SwapNoticeClass;
};

let currentSwapNotice: SwapNotice | null = null;

const SHELF_CLASS_RANK: SwapNoticeClass[] = ["fable", "opus", "sonnet", "haiku"];

function isStrictlyLower(served: SwapNoticeClass, requested: SwapNoticeClass): boolean {
  return SHELF_CLASS_RANK.indexOf(served) > SHELF_CLASS_RANK.indexOf(requested);
}

function capitalClass(shelfClass: SwapNoticeClass): string {
  return shelfClass.charAt(0).toUpperCase() + shelfClass.slice(1);
}

// Records an actual lower-class success from the derived scalars. The served
// class, the model, the provider display name, and the provider's Anthropic
// identity are computed by the caller before the call (see the seam's
// recordStepDownSuccessFromTarget). Returns the single stored record for a
// real step-down and null otherwise; nothing is stored for same-class or
// non-class successes. Message bodies, provider keys, and provider error text
// never reach the notice.
export function recordStepDownSuccess(input: StepDownSuccessInput): SwapNotice | null {
  const requested = parseClassRequest(input.requestedModel);
  if (!requested) {
    return null;
  }
  if (!isStrictlyLower(input.servedClass, requested.shelfClass)) {
    return null;
  }
  const reason = input.hadRequestedClassFailure
    ? `all ${capitalClass(requested.shelfClass)} attempts refused before first token`
    : `no live ${capitalClass(requested.shelfClass)} triple`;
  return recordSwapNotice({
    credentialLabel: input.credentialLabel?.trim() || "none",
    model: input.model,
    provider: input.provider,
    reason,
    requestedClass: requested.shelfClass,
    safeguardsApplies: safeguardsAppliesForIdentity(input.providerIdentity),
    servedClass: input.servedClass,
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
