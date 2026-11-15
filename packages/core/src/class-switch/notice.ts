import type { RouteModelRef } from "@ccr/core/routing/contracts";

// One process-local swap notice record (FALL-02). RED phase: compiling stubs
// only — no production step-down or notice behavior exists before the GREEN
// task passes RED_EVIDENCE_OK. The singleton record, the actual-success
// recording, the latest-swap replacement, and the read-time live-again
// reconciliation land in GREEN behind these exact exports.

export type SwapNoticeRecord = {
  requestedClass: string;
  servedClass: string;
  model: string;
  provider: string;
  credentialLabel: string;
  reason: string;
  sinceAt: string;
  safeguardsApplies: boolean;
};

export type StepDownSuccessInput = {
  requestedModel?: string;
  servedModel?: string;
  target: RouteModelRef | undefined;
  credentialLabel?: string;
  hadRequestedClassFailure: boolean;
};

export function recordStepDownSuccess(_input: StepDownSuccessInput): SwapNoticeRecord | null {
  // RED stub: an actual lower-class success records nothing yet.
  return null;
}

export function recordSwapNotice(_notice: SwapNoticeRecord): SwapNoticeRecord | null {
  // RED stub: replacement of the singleton record is not implemented yet.
  return null;
}

export async function readSwapNotice(_options: { modelRegistry?: unknown } = {}): Promise<SwapNoticeRecord | null> {
  // RED stub: no record exists and no live-again reconciliation runs yet.
  return null;
}

export function clearSwapNotice(): void {
  // RED stub: no process-local notice state to clear yet.
}
