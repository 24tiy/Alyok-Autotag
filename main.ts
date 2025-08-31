import { App, Plugin, PluginManifest, TFile, Notice } from "obsidian";

// ============ Alyok Autotag — Safe block-in-body mode ============

// fenced-блоки (``` … ``` и ~~~ … ~~~) — сюда нельзя вставлять
const FENCE_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.startsWith('#') ? t : `#${t}`))));
}

// найти позицию после ПОСЛЕДНЕГО закрытого fenced-блока
function findSafeAppendIndex(src: string): number {
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src))) lastEnd = m.index + m[0].length;
  return Math.max(lastEnd, src.length);
}

// заменить существующий Alyok-блок или вставить новый в безопасное место
function upsertAlyokBlock(src: string, block: string): string {
  const startMarker = '<!-- Alyok Autotag -->';
  const re = new RegExp(`${startMarker}[\\s\\S]*?$`);
  if (re.test(src)) {
    return src.replace(re, block);
  } else {
    const at = findSafeAppendIndex(src);
    const before = src.slice(0, at).replace(/\s*$/, '');
    const after = src.slice(at);
    return `${before}\n\n${block}\n${after}`;
  }
}

// вызываем это вместо старой вставки блока
async function writeTagsBlockSafely(app: App, file: TFile, tags: string[]) {
  const content = await app.vault.read(file);
  const lines = [
    '<!-- Alyok Autotag -->',
    ...normalizeTags(tags)
  ];
  const block = lines.join('\n');
  const next = upsertAlyokBlock(content, block);
  if (next !== content) {
    await app.vault.modify(file, next);
  }
}

// ================================================================

export default class AlyokAutotagPlugin extends Plugin {
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload() {
    console.log("Alyok Autotag loaded ✅");

    // обработка события при создании файла
    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.processFile(file);
        }
      })
    );

    // обработка события при перемещении файла
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
      // Определяем теги на основе пути к файлу
      // Например: notes/finance/budget.md → ['finance']
      const parts = file.path.split("/");
      const folderTags = parts
        .slice(0, -1) // без имени файла
        .map(f => f.toLowerCase().replace(/[^a-zа-я0-9_-]/gi, ""))
        .filter(Boolean);

      if (folderTags.length === 0) return;

      await writeTagsBlockSafely(this.app, file, folderTags);
    } catch (e) {
      console.error("Alyok Autotag error:", e);
      new Notice("❌ Ошибка в Alyok Autotag (см. консоль)");
    }
  }

  onunload() {
    console.log("Alyok Autotag unloaded ❌");
  }
}
