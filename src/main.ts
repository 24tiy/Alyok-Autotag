import { MarkdownView, Menu, Notice, Plugin, TAbstractFile, TFile, TFolder, Vault, getFrontMatterInfo, normalizePath, parseYaml } from "obsidian";
import { ApplyModal, FolderRuleModal, UntaggedModal } from "./modals";
import { DEFAULT_SETTINGS, Settings, SettingTab } from "./settings";
import {
  cleanFolder,
  folderTag,
  hasTag,
  inFolder,
  isStamp,
  movedPath,
  parentOf,
  readBlock,
  readTags,
  ruleTags,
  sameTags,
  splitTags,
  stamp,
  uniqTags,
  withoutTags,
  writeBlock,
} from "./tags";

const FRESH_MS = 60000;
const SETTLE_MS = 1500;
const FOREIGN_RE = /^(excalidraw-plugin|kanban-plugin)\s*:/m;
const UNTITLED = new Set([
  "Untitled",
  "Без названия",
  "Без назви",
  "Без назвы",
  "未命名",
  "無題のファイル",
  "무제",
  "Unbenannt",
  "Sans titre",
  "Sin título",
  "Sem título",
  "Senza nome",
  "Bez nazwy",
  "Naamloos",
  "Başlıksız",
  "Bez názvu",
  "Chưa đặt tên",
  "Tanpa judul",
]);

type Frontmatter = Record<string, unknown>;

function readFrontmatter(text: string): Frontmatter | null {
  const info = getFrontMatterInfo(text);
  if (!info.exists) return {};
  try {
    const data: unknown = parseYaml(info.frontmatter);
    if (data == null) return {};
    return typeof data === "object" && !Array.isArray(data) ? (data as Frontmatter) : null;
  } catch {
    return null;
  }
}

function createdAt(file: TFile): number {
  return file.stat.ctime || file.stat.mtime || Date.now();
}

function cleanPath(path: string): string {
  const folder = cleanFolder(path);
  return folder ? normalizePath(folder) : "";
}

export default class AlyokAutotag extends Plugin {
  settings!: Settings;
  private settingTab!: SettingTab;
  private tasks: (() => Promise<void>)[] = [];
  private draining = false;
  private timers = new Set<number>();
  private folderMoves: { from: string; to: string }[] = [];

  async onload() {
    await this.loadSettings();
    this.settingTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.addCommands();
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.addFolderMenu(menu, file)));
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", file => this.onCreate(file)));
      this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
    });
  }

  onunload() {
    this.timers.forEach(id => window.clearTimeout(id));
  }

  get marker(): string {
    return this.settings.blockMarker.trim() || DEFAULT_SETTINGS.blockMarker;
  }

  isSkipped(path: string): boolean {
    return this.settings.skipped.some(folder => inFolder(path, folder));
  }

  folders(): string[] {
    return this.app.vault
      .getAllFolders(false)
      .map(folder => folder.path)
      .sort((a, b) => a.localeCompare(b));
  }

  foldersWithoutRules(): string[] {
    const own = new Set(this.settings.rules.filter(rule => splitTags(rule.tags).length).map(rule => cleanFolder(rule.folder)));
    return this.folders().filter(folder => !own.has(folder) && !this.isSkipped(folder));
  }

  private addCommands() {
    this.addCommand({
      id: "retag-current-note",
      name: "Retag current note",
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) {
          this.enqueue(file, async () => {
            if (this.isSkipped(file.path)) new Notice("This folder is skipped");
            else new Notice((await this.retag(file)) ? "Tags updated" : "Nothing to change");
          });
        }
        return true;
      },
    });
    this.addCommand({
      id: "apply-to-all-notes",
      name: "Apply rules to all notes",
      callback: () => new ApplyModal(this.app, this).open(),
    });
    this.addCommand({
      id: "show-folders-without-rules",
      name: "Show folders without rules",
      callback: () => new UntaggedModal(this.app, this).open(),
    });
    this.addCommand({
      id: "rule-for-current-folder",
      name: "Rule for the current folder",
      checkCallback: checking => {
        const folder = this.app.workspace.getActiveFile()?.parent;
        if (!folder || folder.isRoot()) return false;
        if (!checking) new FolderRuleModal(this.app, this, folder.path).open();
        return true;
      },
    });
  }

  private addFolderMenu(menu: Menu, file: TAbstractFile) {
    if (!(file instanceof TFolder) || file.isRoot()) return;
    menu.addItem(item =>
      item
        .setTitle("Autotag rule")
        .setIcon("tags")
        .onClick(() => new FolderRuleModal(this.app, this, file.path).open())
    );
  }

  private enqueue(file: TFile | null, task: () => Promise<unknown>) {
    this.tasks.push(async () => {
      try {
        await task();
      } catch (e) {
        console.error("Alyok Autotag:", file?.path ?? "", e);
        if (file) new Notice(`Alyok Autotag: couldn't update ${file.basename}, see the console`);
      }
    });
    if (!this.draining) void this.drain();
  }

  private async drain() {
    this.draining = true;
    for (let task = this.tasks.shift(); task; task = this.tasks.shift()) await task();
    this.draining = false;
  }

  private onCreate(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (Date.now() - (file.stat.mtime || Date.now()) > FRESH_MS) return;
    const created = createdAt(file);
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      this.enqueue(file, () => this.tagNew(file, created));
    }, SETTLE_MS);
    this.timers.add(id);
  }

  private onRename(file: TAbstractFile, oldPath: string) {
    if (file instanceof TFolder) {
      this.followFolder(oldPath, file.path);
      return;
    }
    if (!(file instanceof TFile) || file.extension !== "md" || parentOf(oldPath) === parentOf(file.path)) return;
    const carried = this.folderMoves.some(move => movedPath(oldPath, move.from, move.to) === file.path);
    this.enqueue(file, () => this.retagMoved(file, oldPath, !carried && this.settings.removeNewOnRename));
  }

  private followFolder(from: string, to: string) {
    const move = { from, to };
    this.folderMoves.push(move);
    window.setTimeout(() => this.folderMoves.splice(this.folderMoves.indexOf(move), 1), 0);
    let changed = false;
    const follow = (path: string) => {
      const next = movedPath(cleanFolder(path), from, to);
      if (next === null) return path;
      changed = true;
      return next;
    };
    for (const rule of this.settings.rules) rule.folder = follow(rule.folder);
    this.settings.skipped = this.settings.skipped.map(follow);
    if (changed) void this.saveSettings();
  }

  private async isForeign(file: TFile): Promise<boolean> {
    const text = await this.app.vault.cachedRead(file);
    return FOREIGN_RE.test(getFrontMatterInfo(text).frontmatter);
  }

  private async tagNew(file: TFile, created: number) {
    if (this.app.vault.getAbstractFileByPath(file.path) !== file || this.isSkipped(file.path) || (await this.isForeign(file))) return;
    const s = this.settings;
    if (s.mode === "block" && readBlock(await this.app.vault.read(file), this.marker) !== null) return;
    if (s.stampTitleOnCreate && UNTITLED.has(file.basename.replace(/ \d+$/, ""))) await this.stampTitle(file, created);
    const rule = ruleTags(file.path, s.rules);
    await this.update(file, cur =>
      uniqTags([
        ...cur,
        ...rule,
        s.addStamp && !cur.some(isStamp) ? stamp(created) : "",
        s.addNewOnCreate && !rule.length ? s.newTag : "",
      ])
    );
  }

  private async stampTitle(file: TFile, created: number) {
    const dir = file.parent && !file.parent.isRoot() ? file.parent.path + "/" : "";
    const name = stamp(created);
    let path = normalizePath(`${dir}${name}.md`);
    for (let i = 1; this.app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${dir}${name}-${i}.md`);
    await this.app.fileManager.renameFile(file, path);
  }

  private async retagMoved(file: TFile, oldPath: string, dropNew: boolean) {
    if (this.isSkipped(file.path) || (await this.isForeign(file))) return;
    const s = this.settings;
    const rule = ruleTags(file.path, s.rules);
    if (s.mode === "block") {
      await this.update(file, (cur, found) =>
        found || rule.length
          ? uniqTags([
              ...rule,
              cur.find(isStamp) ?? (s.addStamp ? stamp(createdAt(file)) : ""),
              !dropNew && hasTag(cur, s.newTag) ? s.newTag : "",
            ])
          : null
      );
      return;
    }
    const old = this.isSkipped(oldPath) ? [] : ruleTags(oldPath, s.rules);
    const drop = [...withoutTags(old, rule), ...(dropNew ? [s.newTag] : [])];
    await this.update(file, cur =>
      uniqTags([...withoutTags(cur, drop), ...rule, rule.length && s.addStamp && !cur.some(isStamp) ? stamp(createdAt(file)) : ""])
    );
  }

  async retag(file: TFile, drop: string[] = []): Promise<boolean> {
    if (this.isSkipped(file.path) || (await this.isForeign(file))) return false;
    const s = this.settings;
    const rule = ruleTags(file.path, s.rules);
    if (s.mode === "block") {
      return this.update(file, (cur, found) =>
        found || rule.length
          ? uniqTags([...rule, cur.find(isStamp) ?? (s.addStamp ? stamp(createdAt(file)) : ""), hasTag(cur, s.newTag) ? s.newTag : ""])
          : null
      );
    }
    const leftover = readBlock(await this.app.vault.read(file), this.marker);
    const removed = leftover !== null && (await this.edit(file, text => writeBlock(text, this.marker, [])));
    const kept = (leftover ?? []).filter(tag => isStamp(tag) || hasTag([s.newTag], tag));
    const updated = await this.update(file, cur => {
      const stamped = cur.some(isStamp);
      return uniqTags([
        ...withoutTags(cur, drop),
        ...rule,
        ...kept.filter(tag => !(stamped && isStamp(tag))),
        rule.length && s.addStamp && !stamped && !kept.some(isStamp) ? stamp(createdAt(file)) : "",
      ]);
    });
    return removed || updated;
  }

  private async retagFiles(files: TFile[], drop: string[] = []) {
    const progress = new Notice(`Alyok Autotag: 0 of ${files.length}`, 0);
    let updated = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        if (await this.retag(files[i], drop)) updated++;
      } catch (e) {
        console.error("Alyok Autotag:", files[i].path, e);
      }
      if (i % 20 === 19) progress.setMessage(`Alyok Autotag: ${i + 1} of ${files.length}`);
    }
    progress.hide();
    new Notice(`Alyok Autotag: notes updated: ${updated}`);
  }

  applyToAll() {
    this.enqueue(null, () => this.retagFiles(this.app.vault.getMarkdownFiles().filter(file => !this.isSkipped(file.path))));
  }

  private filesIn(folder: string): TFile[] {
    const root = this.app.vault.getFolderByPath(folder);
    const files: TFile[] = [];
    if (!root) return files;
    Vault.recurseChildren(root, file => {
      if (file instanceof TFile && file.extension === "md" && !this.isSkipped(file.path)) files.push(file);
    });
    return files;
  }

  private async update(file: TFile, compute: (cur: string[], found: boolean) => string[] | null): Promise<boolean> {
    if (this.settings.mode === "block") {
      const marker = this.marker;
      return this.edit(file, text => {
        const cur = readBlock(text, marker);
        const next = compute(cur ?? [], cur !== null);
        return next && !(cur && sameTags(cur, next)) ? writeBlock(text, marker, next) : text;
      });
    }
    await this.openView(file)?.save();
    const data = readFrontmatter(await this.app.vault.read(file));
    if (!data) return false;
    const cur = readTags(data.tags);
    const next = compute(cur, true);
    if (!next || sameTags(cur, next)) return false;
    await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      const tags = compute(readTags(fm.tags), true);
      if (!tags) return;
      if (tags.length) fm.tags = tags;
      else delete fm.tags;
    });
    return true;
  }

  private openView(file: TFile): MarkdownView | undefined {
    return this.app.workspace
      .getLeavesOfType("markdown")
      .map(leaf => leaf.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.file === file);
  }

  private async edit(file: TFile, change: (text: string) => string): Promise<boolean> {
    const view = this.openView(file);
    if (view) {
      const editor = view.editor;
      const before = editor.getValue();
      const after = change(before);
      if (after === before) return false;
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start++;
      let end = 0;
      while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
      editor.replaceRange(after.slice(start, after.length - end), editor.offsetToPos(start), editor.offsetToPos(before.length - end));
      return true;
    }
    const text = await this.app.vault.read(file);
    if (change(text) === text) return false;
    let changed = false;
    await this.app.vault.process(file, data => {
      const next = change(data);
      changed = next !== data;
      return next;
    });
    return changed;
  }

  async setFolderRule(folder: string, tags: string, skip: boolean, retagNotes: boolean) {
    const s = this.settings;
    const rule = s.rules.find(r => cleanFolder(r.folder) === folder);
    const dropped = withoutTags(splitTags(rule?.tags ?? ""), splitTags(tags));
    if (splitTags(tags).length) {
      if (rule) rule.tags = tags;
      else s.rules.push({ folder, tags });
    } else if (rule) {
      s.rules.splice(s.rules.indexOf(rule), 1);
    }
    s.skipped = s.skipped.filter(f => f !== folder);
    if (skip) s.skipped.push(folder);
    await this.saveSettings();
    this.refreshSettings();
    if (retagNotes && !skip) this.enqueue(null, () => this.retagFiles(this.filesIn(folder), dropped));
  }

  async createRules(nested: boolean, overwrite: boolean) {
    const s = this.settings;
    let added = 0;
    let updated = 0;
    for (const folder of this.folders()) {
      const tag = folderTag(folder, nested);
      if (!tag || this.isSkipped(folder)) continue;
      const rule = s.rules.find(r => cleanFolder(r.folder) === folder);
      if (!rule) {
        s.rules.push({ folder, tags: "#" + tag });
        added++;
      } else if ((overwrite || !splitTags(rule.tags).length) && rule.tags !== "#" + tag) {
        rule.tags = "#" + tag;
        updated++;
      }
    }
    await this.saveSettings();
    this.refreshSettings();
    new Notice(`Rules added: ${added}, updated: ${updated}`);
  }

  refreshSettings() {
    if (this.settingTab.containerEl.isConnected) this.settingTab.display();
  }

  async loadSettings() {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    const data: Settings = { ...DEFAULT_SETTINGS, ...saved };
    data.mode = data.mode === "properties" ? "properties" : "block";
    data.rules = Array.isArray(data.rules)
      ? data.rules.filter(r => r && typeof r.folder === "string").map(r => ({ folder: cleanPath(r.folder), tags: String(r.tags ?? "") }))
      : [];
    data.skipped = Array.isArray(data.skipped) ? data.skipped.map(cleanPath).filter(Boolean) : [];
    data.newTag = splitTags(data.newTag)[0] || DEFAULT_SETTINGS.newTag;
    this.settings = data;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
