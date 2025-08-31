import { App, Plugin, PluginManifest, TFile, Notice } from "obsidian";

const FENCE_PAIR_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const OPEN_FENCE_AT_EOF_RE = /(?:^|\n)(```|~~~)[^\n]*\n[\s\S]*$/;

function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      (tags || [])
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    )
  );
}

function closeOpenFenceAtEOF(src: string): { text: string; closed: boolean } {
  const stripped = src.replace(FENCE_PAIR_RE, "");
  if (OPEN_FENCE_AT_EOF_RE.test(stripped)) {
    return { text: src.replace(/\s*$/, "") + "\n```", closed: true };
  }
  return { text: src, closed: false };
}

function findSafeAppendIndex(src: string): number {
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_PAIR_RE.exec(src))) lastEnd = m.index + m[0].length;
  return Math.max(lastEnd, src.length);
}

function upsertAlyokBlock(src: string, block: string): string {
  const startMarker = "<!-- Alyok Autotag -->";
  const re = new RegExp(`${startMarker}[\\s\\S]*?$`);
  if (re.test(src)) return src.replace(re, block);
  const { text: closedText } = closeOpenFenceAtEOF(src);
  const at = findSafeAppendIndex(closedText);
  const before = closedText.slice(0, at).replace(/\s*$/, "");
  const after = closedText.slice(at);
  return `${before}\n\n${block}\n${after}`;
}

async function writeTagsBlockSafely(app: App, file: TFile, tags: string[]) {
  const content = await app.vault.read(file);
  const lines = ["<!-- Alyok Autotag -->", ...normalizeTags(tags)];
  const block = lines.join("\n");
  const next = upsertAlyokBlock(content, block);
  if (next !== content) await app.vault.modify(file, next);
}

function getTagsForFile(file: TFile): string[] {
  const parts = file.path.split("/");
  const folders = parts.slice(0, -1);
  return folders
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => f.toLowerCase().replace(/[^a-zа-я0-9_-]+/gi, "-"))
    .filter(Boolean);
}

export default class AlyokAutotagPlugin extends Plugin {
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.processFile(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.processFile(file);
        }
      })
    );
  }

  async processFile(file: TFile) {
    try {
      const tags = getTagsForFile(file);
      if (!tags.length) return;
      await writeTagsBlockSafely(this.app, file, tags);
    } catch (e) {
      console.error("Alyok Autotag error:", e);
      new Notice("❌ Alyok Autotag: ошибка — см. консоль");
    }
  }

  onunload() {}
}
