import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { exists, git } from "./state.ts";

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

type Citation = { position: number; path: string; start: number; end: number };

/** Ordered, deduplicated citations; a backticked bare `:N` continues the most recent cited path. */
export function extractCitations(body: string): Citation[] {
  const found: Citation[] = [];
  for (const match of body.matchAll(citation)) {
    if (body.slice(Math.max(0, match.index - 8), match.index).includes("://")) continue; // URL, not a file.
    const start = Number(match[2]);
    found.push({ position: match.index, path: match[1].replaceAll("\\", "/").replace(/^(\.\/)+/, ""), start, end: Number(match[3] ?? match[2]) });
  }
  for (const span of body.matchAll(codeSpan)) {
    const ref = bare.exec(span[1].trim());
    if (!ref) continue;
    const earlier = found.filter((f) => f.position < span.index).at(-1);
    if (!earlier) continue; // A bare ref before any pathed one has nothing to continue.
    const start = Number(ref[1]);
    found.push({ position: span.index, path: earlier.path, start, end: Number(ref[2] ?? ref[1]) });
  }
  found.sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  return found.filter((f) => {
    const key = `${f.path}:${f.start}:${f.end}`;
    if (f.end < f.start || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Anchors for every citation in `body` that resolves to a readable file in `repo`, capped so
 * frontmatter stays bounded. Citations that do not resolve get no anchor and fall back to the
 * checker's heuristic mode, which uses the artifact's recorded commit.
 */
export async function extractAnchors(repo: string, body: string, cap = 100): Promise<Anchor[]> {
  const anchors: Anchor[] = [];
  const dirtyByPath = new Map<string, boolean>();
  for (const cite of extractCitations(body)) {
    if (anchors.length >= cap) break;
    if (cite.path.split("/").some((part) => part === ".." || part === "" || part === ".")) continue;
    const file = join(repo, cite.path);
    if (!(await exists(file))) continue;
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    const lines = normalize(await fs.readFile(file, "utf8")).split("\n");
    if (cite.start < 1 || cite.start > lines.length) continue;
    const slice = lines.slice(cite.start - 1, Math.min(cite.end, lines.length));
    const text = slice.join("\n");
    if (!dirtyByPath.has(cite.path)) {
      dirtyByPath.set(cite.path, Boolean((await git(repo, ["status", "--porcelain", "--", cite.path], true)).trim()));
    }
    anchors.push({
      path: cite.path, start: cite.start, end: cite.end, sha256: anchorHash(text),
      context: [slice[0] ?? "", slice.at(-1) ?? ""],
      ...(dirtyByPath.get(cite.path) ? { dirty: true } : {}),
    });
  }
  return anchors;
}
