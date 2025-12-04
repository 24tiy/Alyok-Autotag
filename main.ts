import {
  App,
  Notice,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  FuzzySuggestModal,
} from "obsidian";

type Mode = "block";

interface Rule {
  folder: string;
  tags: string;
}

interface AlyokAutotagSettings {
  mode: Mode;
  rules: Rule[];
  addNewOnCreate: boolean;
  removeNewOnRename: boolean;
  blockMarker: string;
  stampTitleOnCreate: boolean;
}

const DEFAULT_SETTINGS: AlyokAutotagSettings = {
  mode: "block",
  rules: [],
  addNewOnCreate: true,
  removeNewOnRename: true,
  blockMarker: "<!-- Alyok Autotag -->",
  stampTitleOnCreate: false,
};

const FENCE_PAIR_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const OPEN_FENCE_AT_EOF_RE = /(?:^|\n)(```|~~~)[^\n]*\n[\s\S]*$/;

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function splitTags(s: string): string[] {
  return (s || "").split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
}
function normalizeHash(tags: string[]): string[] {
  return uniq((tags || []).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith("#") ? t : `#${t}`)));
}
function blockRegex(marker: string): RegExp {
  return new RegExp(`${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?$`);
}
function extractBlock(src: string, marker: string): string | null {
  const re = blockRegex(marker);
  const m = src.match(re);
  return m ? m[0] : null;
}
function removeBlock(src: string, marker: string): string {
  const re = blockRegex(marker);
  if (!re.test(src)) return src;
  return src.replace(re, "").replace(/\n{3,}$/, "\n\n");
}
function closeOpenFenceAtEOF(src: string): string {
  const stripped = src.replace(FENCE_PAIR_RE, "");
  if (OPEN_FENCE_AT_EOF_RE.test(stripped)) return src.replace(/\s*$/, "") + "\n```";
  return src;
}
function findSafeAppendIndex(src: string): number {
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_PAIR_RE.exec(src))) lastEnd = m.index + m[0].length;
  return Math.max(lastEnd, src.length);
}
function upsertBlock(src: string, marker: string, lines: string[]): string {
  const re = blockRegex(marker);
  const block = [marker, ...lines].join("\n");
  if (re.test(src)) return src.replace(re, block);
  const closed = closeOpenFenceAtEOF(src);
  const at = findSafeAppendIndex(closed);
  const before = closed.slice(0, at).replace(/\s*$/, "");
  const after = closed.slice(at);
  return `${before}\n\n${block}\n${after}`;
}
function tagsForPathByRules(path: string, rules: Rule[]): string[] {
  const matches = rules.filter(r => {
    const f = (r.folder || "").replace(/^\/+|\/+$/g, "");
    if (!f) return false;
    const norm = f.endsWith("/") ? f : f + "/";
    return path.startsWith(norm) || path === f || path.startsWith(f + "/");
  });
  const all = matches.flatMap(r => splitTags(r.tags || ""));
  return normalizeHash(all);
}
function getAllFolderPaths(app: App): string[] {
  const res = new Set<string>();
  const files = app.vault.getAllLoadedFiles();
  for (const f of files) if (f instanceof TFolder) res.add(f.path);
  const list = Array.from(res);
  list.sort((a, b) => a.localeCompare(b));
  return list;
}
function dateTimeTag(file: TFile): string {
  const d = new Date(file.stat.ctime);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `#${yyyy}-${mm}-${dd}-${hh}-${mi}`;
}
function dateTimeName(file: TFile): string {
  const d = new Date(file.stat.ctime);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}-${mi}`;
}

class FolderSuggestModal extends FuzzySuggestModal<string> {
  items: string[];
  onChooseCb: (val: string) => void;
  constructor(app: App, items: string[], onChoose: (val: string) => void) {
    super(app);
    this.items = items;
    this.onChooseCb = onChoose;
  }
  getItems(): string[] { return this.items; }
  getItemText(item: string): string { return item || "/"; }
  onChooseItem(item: string): void { this.onChooseCb(item); }
}

export default class AlyokAutotagPlugin extends Plugin {
  settings: AlyokAutotagSettings;
  constructor(app: App, manifest: PluginManifest) { super(app, manifest); }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AlyokAutotagSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on("create", async (f) => {
      if (f instanceof TFile && f.extension === "md") await this.onCreate(f);
    }));
    this.registerEvent(this.app.vault.on("rename", async (f) => {
      if (f instanceof TFile && f.extension === "md") await this.onRename(f);
    }));
  }

  async stampTitleIfEnabled(file: TFile): Promise<TFile> {
    if (!this.settings.stampTitleOnCreate) return file;
    const dir = file.parent?.path ?? "";
    const prefix = dir && dir !== "/" ? dir + "/" : "";
    const base = dateTimeName(file);

    let candidate = `${prefix}${base}.md`;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${prefix}${base}-${i}.md`;
      i++;
    }

    await this.app.fileManager.renameFile(file, candidate);
    const newFile = this.app.vault.getAbstractFileByPath(candidate);
    return newFile instanceof TFile ? newFile : file;
  }

  async onCreate(file: TFile) {
    try {
      file = await this.stampTitleIfEnabled(file);
      const ruleTags = tagsForPathByRules(file.path, this.settings.rules);
      const tags = normalizeHash([
        ...ruleTags,
        dateTimeTag(file),
        ...(this.settings.addNewOnCreate && ruleTags.length === 0 ? ["#new"] : []),
      ]);
      await this.writeTagsBlock(file, tags);
    } catch (e) {
      console.error("Alyok Autotag create error:", e);
      new Notice("Alyok Autotag: error on create");
    }
  }

  async onRename(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const prevBlock = extractBlock(content, this.settings.blockMarker);
      const prevHasNew = prevBlock ? /(^|\s)#new(\s|$)/.test(prevBlock) : false;

      const ruleTags = tagsForPathByRules(file.path, this.settings.rules);
      let tags = normalizeHash([...ruleTags, dateTimeTag(file)]);
      if (!this.settings.removeNewOnRename && prevHasNew) {
        tags = normalizeHash([...tags, "#new"]);
      }
      await this.writeTagsBlock(file, tags);
    } catch (e) {
      console.error("Alyok Autotag rename error:", e);
      new Notice("Alyok Autotag: error on rename");
    }
  }

  async writeTagsBlock(file: TFile, tagsHash: string[]) {
    if (this.settings.mode !== "block") return;
    const content = await this.app.vault.read(file);
    const marker = this.settings.blockMarker || DEFAULT_SETTINGS.blockMarker;
    const lines = normalizeHash(tagsHash);
    const next = lines.length > 0 ? upsertBlock(content, marker, lines) : removeBlock(content, marker);
    if (next !== content) await this.app.vault.modify(file, next);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() { await this.saveData(this.settings); }
}

class AlyokAutotagSettingTab extends PluginSettingTab {
  plugin: AlyokAutotagPlugin;
  constructor(app: App, plugin: AlyokAutotagPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Mode")
      .addDropdown(d =>
        d.addOption("block", "Block")
          .setValue(this.plugin.settings.mode)
          .onChange(async (v: Mode) => {
            this.plugin.settings.mode = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Add #new on create")
      .addToggle(t =>
        t.setValue(this.plugin.settings.addNewOnCreate)
          .onChange(async v => {
            this.plugin.settings.addNewOnCreate = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove #new on rename")
      .addToggle(t =>
        t.setValue(this.plugin.settings.removeNewOnRename)
          .onChange(async v => {
            this.plugin.settings.removeNewOnRename = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Stamp date-time to title on create")
      .setDesc("New note title will default to format 2025-08-31-14-35")
      .addToggle(t =>
        t.setValue(this.plugin.settings.stampTitleOnCreate)
          .onChange(async v => {
            this.plugin.settings.stampTitleOnCreate = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Block marker")
      .addText(t =>
        t.setValue(this.plugin.settings.blockMarker)
          .onChange(async v => {
            this.plugin.settings.blockMarker = v || DEFAULT_SETTINGS.blockMarker;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Rules");
    const rulesWrap = containerEl.createDiv();

    const renderRules = () => {
      rulesWrap.empty();
      const allFolders = getAllFolderPaths(this.app);
      const options: Record<string, string> = { "": "Select folder" };
      allFolders.forEach(p => (options[p] = p));

      this.plugin.settings.rules.forEach((rule, idx) => {
        const row = rulesWrap.createDiv({ cls: "alyok-rule-row" });
        const s = new Setting(row).setName(`Rule ${idx + 1}`);

        s.addDropdown(dd => {
          dd.addOptions(options);
          const val = rule.folder && options[rule.folder] ? rule.folder : "";
          dd.setValue(val);
          dd.onChange(async (v) => {
            this.plugin.settings.rules[idx].folder = v;
            await this.plugin.saveSettings();
          });
        });

        s.addExtraButton(btn => {
          btn.setIcon("folder");
          btn.setTooltip("Choose folder");
          btn.onClick(() => {
            const modal = new FolderSuggestModal(this.app, allFolders, (chosen) => {
              this.plugin.settings.rules[idx].folder = chosen;
              void this.plugin.saveSettings().then(() => renderRules());
            });
            modal.open();
          });
        });

        s.addText(tt =>
          tt.setPlaceholder("#tag1 #tag2 or tag1, tag2")
            .setValue(rule.tags)
            .onChange(async v => {
              this.plugin.settings.rules[idx].tags = v;
              await this.plugin.saveSettings();
            })
        );

        s.addExtraButton(b =>
          b.setIcon("cross")
            .setTooltip("Delete rule")
            .onClick(async () => {
              this.plugin.settings.rules.splice(idx, 1);
              await this.plugin.saveSettings();
              renderRules();
            })
        );
      });

      new Setting(rulesWrap)
        .setName("Add rule")
        .addButton(b =>
          b.setButtonText("+").onClick(async () => {
            this.plugin.settings.rules.push({ folder: "", tags: "" });
            await this.plugin.saveSettings();
            renderRules();
          })
        );
    };

    renderRules();
  }
}
