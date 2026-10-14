import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { git, ManagedPathError, safePath } from "./state.ts";

/**
 * Citation anchors: what the cited code said when an artifact was published, so a later
 * pickup can prove a citation fresh, follow it when it moved, and grade it when it changed.
 *
 * The grammar and the normalization contract are shared with scripts/check-staleness.py and
 * scripts/_driftmeta.py — one definition, two implementations, one parity test. Anchors are
 * written once into artifact frontmatter and never updated; forwarded locations are computed
 * at read time by the checker and never stored back.
 */
export interface Anchor {
  path: string;
  start: number;
  end: number;
  sha256: string;
  /** First and last normalized cited lines: the checker's search needle when history is gone. */
  context: [string, string];
  /** The cited file had uncommitted changes at publication; the checker grades it uncertain. */
  dirty?: boolean;
}

// A file path with a letter-led extension, then :start[-end]. Keep in lockstep with CITATION
// in scripts/check-staleness.py: the extension rule keeps timestamps and URL ports out.
const citation = /(?<![\w:/\\])([A-Za-z0-9_][A-Za-z0-9_.\-]*(?:[\\/][A-Za-z0-9_.\-]+)*\.[A-Za-z][A-Za-z0-9]{0,7}):(\d+)(?:-(\d+))?/g;
const codeSpan = /`([^`\n]+)`/g;
const bare = /^:(\d+)(?:-(\d+))?$/;

/** The anchor normalization contract: trailing whitespace stripped per line, LF joins. */
export const normalize = (text: string): string => text.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/\s+$/u, "")).join("\n");

/** SHA-256 hex of normalized cited text. Must stay identical to _driftmeta.anchor_hash. */
export const anchorHash = (text: string): string => createHash("sha256").update(normalize(text), "utf8").digest("hex");

type Citation = { position: number; path: string; start: number; end: number; reference: string };

function cited(position: number, path: string, first: string, last = first): Citation {
  // Reference-string dedup must match Python's (path, int, int) keys, even beyond JS's safe integer range.
  const start = first.replace(/^0+(?=\d)/, ""), end = last.replace(/^0+(?=\d)/, "");
  return { position, path, start: Number(start), end: Number(end), reference: `${path}:${start}${end === start ? "" : `-${end}`}` };
}

/** Ordered, deduplicated citations; optionally retain invalid ranges for capture accounting. */
export function extractCitations(body: string, includeInvalid = false): Citation[] {
  const found: Citation[] = [];
  for (const match of body.matchAll(citation)) {
    if (body.slice(Math.max(0, match.index - 8), match.index).includes("://")) continue; // URL, not a file.
    found.push(cited(match.index, match[1].replaceAll("\\", "/").replace(/^(\.\/)+/, ""), match[2], match[3]));
  }
  for (const span of body.matchAll(codeSpan)) {
    const ref = bare.exec(span[1].trim());
    if (!ref) continue;
    const earlier = found.filter((f) => f.position < span.index).sort((a, b) => a.position - b.position).at(-1);
    if (!earlier) continue; // A bare ref before any pathed one has nothing to continue.
    found.push(cited(span.index, earlier.path, ref[1], ref[2]));
  }
  found.sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  return found.filter((f) => {
    if ((!includeInvalid && f.end < f.start) || seen.has(f.reference)) return false;
    seen.add(f.reference);
    return true;
  });
}

export const anchorSkipReasons = ["unsafe-path", "file-not-found", "not-a-file", "file-too-large", "invalid-range", "read-error", "cap-reached"] as const;
export type AnchorSkipReason = typeof anchorSkipReasons[number];
export interface AnchorSkip { reference: string; reason: AnchorSkipReason; reference_truncated?: true }
export interface AnchorCoverage {
  status: "not-applicable" | "complete" | "partial";
  /** Unique recognized numeric references, including invalid ranges that cannot be captured. */
  eligible: number;
  captured: number;
  skipped_count: number;
  skipped_by_reason: Partial<Record<AnchorSkipReason, number>>;
  /** First 25 skipped references; totals above include all skipped references. */
  skipped: AnchorSkip[];
}
export interface AnchorCapture { anchors: Anchor[]; coverage: AnchorCoverage }

/** Capture with deterministic accounting; completeness describes capture, not trust or freshness. */
export async function captureAnchors(repo: string, body: string, cap = 100): Promise<AnchorCapture> {
  if (!Number.isSafeInteger(cap) || cap < 0) throw new Error("Anchor cap must be a nonnegative integer");
  const citations = extractCitations(body, true);
  const anchors: Anchor[] = [];
  const coverage: AnchorCoverage = { status: "not-applicable", eligible: citations.length, captured: 0, skipped_count: 0, skipped_by_reason: {}, skipped: [] };
  const skip = (cite: Citation, reason: AnchorSkipReason) => {
    coverage.skipped_count++;
    coverage.skipped_by_reason[reason] = (coverage.skipped_by_reason[reason] ?? 0) + 1;
    if (coverage.skipped.length < 25) coverage.skipped.push({ reference: cite.reference.slice(0, 512), reason, ...(cite.reference.length > 512 ? { reference_truncated: true as const } : {}) });
  };
  const dirtyByPath = new Map<string, boolean>();
  for (const cite of citations) {
    if (!Number.isSafeInteger(cite.start) || !Number.isSafeInteger(cite.end) || cite.start < 1 || cite.end < cite.start) {
      skip(cite, "invalid-range"); continue;
    }
    if (cite.path.split("/").some((part) => part === ".." || part === "" || part === ".")) {
      skip(cite, "unsafe-path"); continue;
    }
    if (anchors.length >= cap) { skip(cite, "cap-reached"); continue; }
    let lines: string[];
    try {
      const file = await safePath(repo, join(repo, cite.path));
      const stat = await fs.stat(file);
      if (!stat.isFile()) { skip(cite, "not-a-file"); continue; }
      if (stat.size > 2 * 1024 * 1024) { skip(cite, "file-too-large"); continue; }
      lines = normalize(await fs.readFile(file, "utf8")).split("\n");
    } catch (error: any) {
      if (error instanceof ManagedPathError) skip(cite, "unsafe-path");
      else if (error.code === "ENOENT" || error.code === "ENOTDIR") skip(cite, "file-not-found");
      else if (typeof error.code === "string") skip(cite, "read-error");
      else throw error; // Do not disguise implementation errors as ordinary skipped references.
      continue;
    }
    if (cite.start > lines.length || cite.end > lines.length) { skip(cite, "invalid-range"); continue; }
    const slice = lines.slice(cite.start - 1, cite.end);
    if (!dirtyByPath.has(cite.path)) {
      dirtyByPath.set(cite.path, Boolean((await git(repo, ["status", "--porcelain", "--", cite.path], true)).trim()));
    }
    anchors.push({ path: cite.path, start: cite.start, end: cite.end, sha256: anchorHash(slice.join("\n")),
      context: [slice[0] ?? "", slice.at(-1) ?? ""], ...(dirtyByPath.get(cite.path) ? { dirty: true } : {}) });
  }
  coverage.captured = anchors.length;
  coverage.status = !coverage.eligible ? "not-applicable" : coverage.skipped_count ? "partial" : "complete";
  return { anchors, coverage };
}

/** Compatibility wrapper for callers that need only the anchor payload. */
export async function extractAnchors(repo: string, body: string, cap = 100): Promise<Anchor[]> {
  return (await captureAnchors(repo, body, cap)).anchors;
}
