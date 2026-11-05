export interface Rule {
  folder: string;
  tags: string;
}

const STAMP_RE = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
const TAG_LINE_RE = /^[ \t]*#[^\s#]+(?:[ \t]+#[^\s#]+)*[ \t]*$/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

export function cleanFolder(path: string): string {
  return (path || "").trim().replace(/^\/+|\/+$/g, "");
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function inFolder(path: string, folder: string): boolean {
  const f = cleanFolder(folder);
  return f !== "" && (path === f || path.startsWith(f + "/"));
}

export function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(from + "/")) return to + path.slice(from.length);
  return null;
}

export function uniqTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter(tag => {
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitTags(text: string): string[] {
  return uniqTags((text || "").split(/[\s,]+/).map(tag => tag.replace(/^#+/, "")));
}

export function readTags(value: unknown): string[] {
  if (typeof value === "string") return splitTags(value);
  if (Array.isArray(value)) return uniqTags(value.flatMap(v => (typeof v === "string" || typeof v === "number" ? splitTags(String(v)) : [])));
  return [];
}

export function hasTag(tags: string[], tag: string): boolean {
  return tags.some(t => t.toLowerCase() === tag.toLowerCase());
}

export function withoutTags(tags: string[], drop: string[]): string[] {
  return tags.filter(t => !hasTag(drop, t));
}

export function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}

export function isStamp(tag: string): boolean {
  return STAMP_RE.test(tag);
}

export function stamp(time: number): string {
  const d = new Date(time);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}-${two(d.getMinutes())}`;
}

export function ruleTags(path: string, rules: Rule[]): string[] {
  return uniqTags(rules.filter(r => inFolder(path, r.folder)).flatMap(r => splitTags(r.tags)));
}

function tagPart(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\p{M}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function folderTag(folder: string, nested: boolean): string {
  const parts = cleanFolder(folder).split("/").map(tagPart).filter(Boolean);
  const tag = nested ? parts.join("/") : parts[parts.length - 1] || "";
  return /^[\d/]+$/.test(tag) ? "_" + tag : tag;
}

interface Scan {
  block: { start: number; end: number; tags: string[] } | null;
  openFence: string | null;
}

function scan(lines: string[], marker: string): Scan {
  let fence: { ch: string; len: number } | null = null;
  let block: Scan["block"] = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FENCE_RE);
    if (m) {
      if (!fence) fence = { ch: m[1][0], len: m[1].length };
      else if (m[1][0] === fence.ch && m[1].length >= fence.len && !m[2].trim()) fence = null;
      continue;
    }
    if (fence || lines[i].trim() !== marker) continue;
    let end = i + 1;
    while (end < lines.length && TAG_LINE_RE.test(lines[end])) end++;
    const tags = lines.slice(i + 1, end).join(" ").split(/\s+/).filter(Boolean).map(tag => tag.slice(1));
    block = { start: i, end, tags };
  }
  return { block, openFence: fence ? fence.ch.repeat(fence.len) : null };
}

export function readBlock(content: string, marker: string): string[] | null {
  return scan(content.split(/\r?\n/), marker).block?.tags ?? null;
}

export function writeBlock(content: string, marker: string, tags: string[]): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const { block, openFence } = scan(lines, marker);
  const blockLines = tags.length ? [marker, ...tags.map(tag => "#" + tag)] : [];

  if (block) {
    lines.splice(block.start, block.end - block.start, ...blockLines);
    if (blockLines.length) return lines.join(eol);
    if (lines.slice(block.start).every(line => !line.trim())) {
      const rest = lines.slice(0, block.start).join(eol).replace(/\s+$/, "");
      return rest ? rest + eol : "";
    }
    if (block.start > 0 && !lines[block.start - 1].trim() && !lines[block.start].trim()) lines.splice(block.start, 1);
    return lines.join(eol);
  }

  if (!blockLines.length) return content;
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (openFence) lines.push(openFence);
  return [lines.join(eol), "", blockLines.join(eol), ""].join(eol);
}
