#!/usr/bin/env node
/**
 * Hotfix for the bundled `@the-next-ai/ai-gateway` runtime.
 *
 * Why: the gateway wraps every upstream failure in an aggregate error whose
 * `error.message` is always "All target providers failed." Claude Code only
 * recovers from context overflow when it recognizes the message (it reacts to
 * `capability_rejected: prompt_too_long`, `Prompt is too long`, ...). Wrapped
 * messages break reactive compaction and max-token retry.
 *
 * This script rewrites two things in the minified bundles (source of the
 * gateway package is not in this repo):
 *
 *   1. Aggregate error message
 *      - context-overflow causes become `capability_rejected: prompt_too_long`
 *      - a single failed attempt surfaces its own upstream message
 *      - several attempts get a short `[provider|status] message` summary
 *
 *   2. Model resolver
 *      - a model id discovered as `groq/openai/gpt-oss-120b` (provider prefix
 *        plus a nested vendor prefix) now resolves to the configured
 *        `openai/gpt-oss-120b` instead of failing model resolution.
 *
 * Usage:
 *   node scripts/apply-gateway-recovery-hotfix.mjs            # dry run
 *   node scripts/apply-gateway-recovery-hotfix.mjs --apply    # rewrite files
 *
 * Every rewritten file gets a timestamped `.bak-ccr-recovery-*` copy.
 * The script is idempotent: already patched files are reported and skipped.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const apply = process.argv.includes("--apply");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");

const targets = [
  path.join(projectRoot, "node_modules/@the-next-ai/ai-gateway/dist/index.js"),
  path.join(home, ".local/lib/node_modules/@musistudio/claude-code-router/node_modules/@the-next-ai/ai-gateway/dist/index.js"),
  path.join(home, ".local/lib/node_modules/@musistudio/claude-code-router/dist/main/next-ai-gateway.js"),
  path.join(projectRoot, "packages/cli/dist/main/next-ai-gateway.js"),
  path.join(projectRoot, "packages/core/dist/main/next-ai-gateway.js"),
  path.join(projectRoot, "packages/electron/dist/main/next-ai-gateway.js"),
];

/** Builds `message:<iife>(<attemptsVar>)` for the aggregate error literal. */
function aggregateMessageExpression(attemptsVar) {
  return (
    "message:((A)=>{try{" +
    "A=A||[];" +
    'const norm=(x)=>typeof x==="string"&&x.trim()?x.trim():"";' +
    "const pick=(o)=>{" +
    'const d=o&&o.details&&typeof o.details==="object"?o.details:void 0;' +
    "const list=[" +
    "o&&o.message," +
    "d&&d.error&&typeof d.error===\"object\"?d.error.message:d&&d.error," +
    'd&&typeof d.message==="string"?d.message:void 0,' +
    'typeof d==="string"?d:void 0,' +
    'd&&typeof d.raw==="string"?d.raw:void 0,' +
    'd&&d.raw&&typeof d.raw==="object"?d.raw.message:void 0' +
    "].map(norm).filter(Boolean);" +
    "const generic=(x)=>/^(upstream request failed\\.?|request failed\\.?|bad gateway\\.?|an error occurred\\.?)$/i.test(x);" +
    "return list.sort((a,b)=>(generic(a)?1:0)-(generic(b)?1:0))};" +
    'if(!A.length)return "All target providers failed.";' +
    "const L=A[A.length-1],C=pick(L);" +
    "const ctx=C.find((x)=>/prompt is too long|input is too long|exceed context limit|maximum context length|context length exceeded|context_length_exceeded|please reduce the length|reduce the length of the (?:messages|prompt)|too many input tokens|input length and|maximum number of tokens/i.test(x));" +
    'if(ctx)return "capability_rejected: prompt_too_long";' +
    'if(A.length===1)return C[0]||"All target providers failed.";' +
    'return "All target providers failed. "+A.slice(-3).map((a)=>{' +
    "const m=pick(a)[0]||\"\";" +
    'return "["+(a.provider||"?")+(typeof a.status==="number"?"|"+a.status:"")+"] "+m' +
    '}).join(" | ")' +
    '}catch(e){return "All target providers failed."}})(' +
    attemptsVar +
    ")"
  );
}

const aggregatePattern =
  /message:"All target providers failed\.",(target_providers:[\w$]+\.map\([\w$]+=>[\w$]+\.provider\),target_provider_names:[\w$]+\.map\([\w$]+=>[\w$]+\.providerConfig\?\.name\)\.filter\(Boolean\),attempts:)([\w$]+)\.map\(/g;

const resolverPattern =
  /let o=(\w+)\(e,(\w+)\);return o&&\2\.models\.includes\(o\)\?\{ok:!0,value:o\}:\{ok:!1,error:/g;

/** Suffix fallback for ids that keep a nested vendor prefix. */
function resolverReplacement(fn, cfg) {
  return (
    `let o=${fn}(e,${cfg});` +
    `if(!(o&&${cfg}.models.includes(o)))o=${cfg}.models.find(function(x){return x.endsWith("/"+e)});` +
    `return o&&${cfg}.models.includes(o)?{ok:!0,value:o}:{ok:!1,error:`
  );
}

let patched = 0;
let skipped = 0;

for (const file of targets) {
  if (!existsSync(file)) {
    console.log(`skip  ${file} (not installed)`);
    skipped += 1;
    continue;
  }
  const source = readFileSync(file, "utf8");
  const alreadyHasMarker = source.includes("capability_rejected: prompt_too_long");

  let aggregateHits = 0;
  let resolverHits = 0;
  let next = source.replace(aggregatePattern, (_match, tail, attemptsVar) => {
    aggregateHits += 1;
    return `${aggregateMessageExpression(attemptsVar)},${tail}${attemptsVar}.map(`;
  });
  next = next.replace(resolverPattern, (match, fn, cfg) => {
    resolverHits += 1;
    return resolverReplacement(fn, cfg);
  });

  if (aggregateHits === 0 && resolverHits === 0) {
    console.log(`skip  ${file} (${alreadyHasMarker ? "already patched" : "no anchors"})`);
    skipped += 1;
    continue;
  }

  console.log(`${apply ? "patch" : "would patch"}  ${file}`);
  console.log(`        aggregate sites: ${aggregateHits}, resolver sites: ${resolverHits}`);

  if (!apply) continue;

  copyFileSync(file, `${file}.bak-ccr-recovery-${stamp}`);
  writeFileSync(file, next);
  patched += 1;
}

console.log("");
if (apply) {
  console.log(`Patched ${patched} file(s), skipped ${skipped}.`);
  console.log("Restart the CCR service for the gateway to load the new bundle.");
} else {
  console.log("Dry run only. Re-run with --apply to rewrite the files.");
}
