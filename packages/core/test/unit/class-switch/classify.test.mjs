import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyModel,
  classForScore,
  matchOpenRouterModel,
  scoreArtificialAnalysis
} from "@ccr/core/class-switch/catalog.ts";

function classify(provider, model, artificialAnalysis, extra = {}) {
  return classifyModel({ provider, model, artificialAnalysis, ...extra });
}

test("command-a-plus scores within 1e-9 of 15.44 and is haiku", () => {
  const score = scoreArtificialAnalysis({
    agentic_index: 1,
    coding_index: 27.8,
    intelligence_index: 6.2
  });
  assert.ok(Math.abs((score ?? 0) - 15.44) < 1e-9);
  const result = classify("cohere", "command-a-plus", {
    agentic_index: 1,
    coding_index: 27.8,
    intelligence_index: 6.2
  });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "haiku");
  assert.ok(Math.abs((result.score ?? 0) - 15.44) < 1e-9);
});

test("motif-3 scores within 1e-9 of 50.3375 and is opus", () => {
  const score = scoreArtificialAnalysis({
    agentic_index: 28.4,
    coding_index: 63.5,
    intelligence_index: null
  });
  assert.ok(Math.abs((score ?? 0) - 50.3375) < 1e-9);
  const result = classify("motif-technologies", "motif-3", {
    agentic_index: 28.4,
    coding_index: 63.5,
    intelligence_index: null
  });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "opus");
});

test("exact score cuts 62, 50, and 28 land on fable, opus, and sonnet", () => {
  assert.equal(classForScore(62, 2), "fable");
  assert.equal(classForScore(50, 2), "opus");
  assert.equal(classForScore(28, 2), "sonnet");
  const fableIndexes = { agentic_index: 63, coding_index: 63, intelligence_index: 63 };
  const opusIndexes = { agentic_index: 50, coding_index: 50, intelligence_index: 50 };
  const sonnetIndexes = { agentic_index: 28, coding_index: 28, intelligence_index: 28 };
  assert.ok(scoreArtificialAnalysis(fableIndexes) >= 62);
  assert.ok(scoreArtificialAnalysis(opusIndexes) >= 50 && scoreArtificialAnalysis(opusIndexes) < 62);
  assert.ok(scoreArtificialAnalysis(sonnetIndexes) >= 28 && scoreArtificialAnalysis(sonnetIndexes) < 50);
  assert.equal(classify("p", "fixture", fableIndexes).class, "fable");
  assert.equal(classify("p", "fixture", opusIndexes).class, "opus");
  assert.equal(classify("p", "fixture", sonnetIndexes).class, "sonnet");
});

test("score boundaries 61.9, 49.9, and 27.9 land on opus, sonnet, and haiku", () => {
  assert.equal(classify("p", "m", { coding_index: 61.9, agentic_index: 61.9 }).class, "opus");
  assert.equal(classify("p", "m", { coding_index: 49.9, agentic_index: 49.9 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 27.9, agentic_index: 27.9 }).class, "haiku");
});

test("one-index cap places 62 and 53.9 on sonnet, 28 on sonnet, 27 on haiku", () => {
  assert.equal(classify("p", "m", { coding_index: 62 }).class, "sonnet");
  assert.equal(classify("p", "m", { intelligence_index: 53.9 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 28 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 27 }).class, "haiku");
});

test("one present index of 40 returns sonnet and score equals 40", () => {
  const result = classify("p", "m", { coding_index: 40 });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "sonnet");
  assert.equal(result.score, 40);
});

test("null, missing, NaN, and Infinity indexes are not present", () => {
  assert.equal(classify("p", "m", {}).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: null }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: Number.NaN }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: Number.POSITIVE_INFINITY }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: "40" }).kind, "excluded");
});

test("tier tokens are whole tokens only and case-insensitive", () => {
  const consoleResult = classify("p", "console-model", undefined);
  assert.equal(consoleResult.kind, "excluded");
  assert.equal(consoleResult.reason, "no-index");

  assert.equal(classify("p", "my-fable-model", undefined).class, "fable");
  assert.equal(classify("p", "ASTRA-9", undefined).class, "fable");
  assert.equal(classify("p", "gpt-5.6-sol", undefined).class, "opus");
  assert.equal(classify("p", "terra-lite", undefined).class, "sonnet");
  assert.equal(classify("p", "luna-nano", undefined).class, "haiku");
});

test("flash, mini, nano, and lite do not set a class", () => {
  const result = classify("inclusionai", "ling-3.2-flash:free", undefined);
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "no-index");
});

test("gpt-5.6-sol with no indexes is opus", () => {
  const result = classify("openai", "gpt-5.6-sol", undefined);
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "opus");
  assert.equal(result.tierClass, "opus");
  assert.equal(result.score, undefined);
});

test("two tier classes one step apart with no score shelf the higher class", () => {
  const result = classify("p", "fable-opus-bridge", undefined);
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "fable");
  assert.equal(result.score, undefined);
});

test("hex id abcdef0123456789 with score 62 is fable", () => {
  const scored = classify("p", "abcdef0123456789", {
    agentic_index: 63,
    coding_index: 63,
    intelligence_index: 63
  });
  assert.equal(scored.kind, "shelf");
  assert.equal(scored.class, "fable");
  const bare = classify("p", "abcdef0123456789", undefined);
  assert.equal(bare.kind, "excluded");
  assert.equal(bare.reason, "no-index");
});

test("matchOpenRouterModel uses id or canonical_slug with case insensitivity", () => {
  const rows = [
    { id: "OpenAI/GPT-5", canonical_slug: "openai/gpt-5" },
    { id: "other/x", canonical_slug: "other/x" }
  ];
  assert.deepEqual(matchOpenRouterModel("openai/gpt-5", rows)?.id, "OpenAI/GPT-5");
  assert.equal(matchOpenRouterModel("openai/gpt-5", [...rows, { id: "openai/gpt-5", canonical_slug: "dup" }]), undefined);
});

test("matchOpenRouterModel final segment rule applies only without a slash", () => {
  const rows = [
    { id: "a/foo", canonical_slug: "a/foo" },
    { id: "b/foo", canonical_slug: "b/foo" }
  ];
  assert.equal(matchOpenRouterModel("foo", rows), undefined);
  assert.deepEqual(matchOpenRouterModel("foo", [rows[0]])?.id, "a/foo");
  assert.deepEqual(matchOpenRouterModel("a/foo", rows)?.id, "a/foo");
});

test("gemini-4-hydrogen batch is excluded", () => {
  const result = classify("google", "gemini-4-hydrogen:batch", { intelligence_index: 53.9 });
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "batch");
});

test("batch colon segments are case-insensitive and do not match batcher", () => {
  assert.equal(classify("p", "foo:BATCH", { coding_index: 70 }).reason, "batch");
  assert.equal(classify("p", "foo:batch:free", { coding_index: 70 }).reason, "batch");
  assert.notEqual(classify("p", "foo:batcher", { coding_index: 70 }).reason, "batch");
  assert.equal(classify("p", "foo:free", { coding_index: 70 }).kind, "shelf");
});

test("batch wins over embed token and score", () => {
  const result = classify("p", "text-embedding:batch", { coding_index: 80 });
  assert.equal(result.reason, "batch");
});

test("non-text output modalities and architecture exclude models", () => {
  assert.equal(
    classify("p", "image-only", undefined, { outputModalities: ["image"] }).reason,
    "non-text"
  );
  assert.equal(classify("p", "empty-out", undefined, { outputModalities: [] }).reason, "non-text");
  assert.equal(
    classify("p", "diagram", undefined, { architectureModality: "text+image->image" }).reason,
    "non-text"
  );
  assert.equal(classify("p", "normal", undefined, { architectureModality: "text->text" }).kind, "excluded");
});

test("text-only vision output stays eligible", () => {
  const result = classify("p", "vision-chat", undefined, {
    architectureModality: "text+image->text",
    outputModalities: ["text"]
  });
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "no-index");
});

test("embed and moderation id tokens are non-text", () => {
  assert.equal(classify("p", "openai-text-embedding-3", undefined).reason, "non-text");
  assert.equal(classify("p", "openai-text-EMBEDDING-3", undefined).reason, "non-text");
  assert.notEqual(classify("p", "textembeddingservice", undefined).reason, "non-text");
});

test("gemini hydride one-index opus token shelves sonnet", () => {
  const result = classify("google", "gemini-4-hydrogen-opus", { intelligence_index: 53.9 });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "sonnet");
});

test("gemini hydride one-index fable token waits in review", () => {
  const result = classify("google", "gemini-4-hydrogen-fable", { intelligence_index: 53.9 });
  assert.equal(result.kind, "review");
  assert.equal(result.reason, "score-tier-disagree");
  assert.equal(result.scoreClass, "sonnet");
  assert.equal(result.tierClass, "fable");
  assert.notEqual(result.kind, "shelf");
});
