import { App, Plugin, PluginSettingTab, Setting, TFile, normalizePath } from "obsidian";

type Rule = { folder: string; tags: string[] };
interface AutotagSettings {
  rulesText: string;
  recursive: boolean;
}
const DEFAULT_SETTINGS: AutotagSettings = {
  rulesText: "",
  recursive: true
};

export default class AlyokAutotagPlugin extends Plugin {
  settings: AutotagSettings;
  onunloadFns: Array<() => void> = [];

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new AutotagSettingTab(this.app, this));

    const offCreate = this.app.vault.on("create", async (f) => {
      if (f instanceof TFile && this.isMd(f)) await this.applyToFile(f);
    });
    const offRename = this.app.vault.on("rename", async (f, oldPath) => {
      if (f instanceof TFile && this.isMd(f)) await this.applyToFile(f);
    });
    const offModify = this.app.vault.on("modify", async (f) => {
      if (f instanceof TFile && this.isMd(f)) await this.applyToFile(f);
    });

    this.onunloadFns.push(
      () => this.app.vault.offref(offCreate),
      () => this.app.vault.offref(offRename),
      () => this.app.vault.offref(offModify)
    );

    this.addCommand({
      id: "apply-rules-to-all-notes",
      name: "Apply rules to all notes",
      callback: async () => {
        const notes = this.app.vault.getMarkdownFiles();
        for (const f of notes) await this.applyToFile(f);
        new Notice("Alyok Autotag: done");
      }
    });
  }

  onunload() {
    for (const fn of this.onunloadFns) fn();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  isMd(f: TFile) {
    return f.extension.toLowerCase() === "md";
  }

  parseRules(): Rule[] {
    const lines = this.settings.rulesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length && !s.startsWith("#"));
    const rules: Rule[] = [];
    for (const line of lines) {
      const m = line.split("=>");
      if (m.length !== 2) continue;
      const folder = normalizePath(m[0].trim().replace(/^["']|["']$/g, ""));
      const tags = m[1]
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length)
        .map((t) => (t.startsWith("#") ? t.slice(1) : t));
      if (!folder || tags.length === 0) continue;
      rules.push({ folder, tags });
    }
    return rules;
  }

  pathInFolder(filePath: string, ruleFolder: string) {
    const p = normalizePath(filePath);
    const rf = normalizePath(ruleFolder).replace(/\/+$/, "");
    if (this.settings.recursive) {
      if (p === rf) return true;
      return p.startsWith(rf + "/");
    } else {
      const parent = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
      return normalizePath(parent) === rf;
    }
  }

  tagsForPath(filePath: string): string[] {
    const rules = this.parseRules();
    const set = new Set<string>();
    for (const r of rules) if (this.pathInFolder(filePath, r.folder)) for (const t of r.tags) set.add(t);
    return Array.from(set);
  }

  async applyToFile(file: TFile) {
    const tags = this.tagsForPath(file.path);
    if (tags.length === 0) return;

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const current = fm["tags"];
      let list: string[] = [];
      if (Array.isArray(current)) {
        list = current.map(String);
      } else if (typeof current === "string") {
        list = current.split(",").map((x) => x.trim()).filter(Boolean);
      }
      const s = new Set<string>(list.map((x) => (x.startsWith("#") ? x.slice(1) : x)));
      for (const t of tags) s.add(t);
      const out = Array.from(s);
      fm["tags"] = out;
    });
  }
}

class AutotagSettingTab extends PluginSettingTab {
  plugin: AlyokAutotagPlugin;

  constructor(app: App, plugin: AlyokAutotagPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Rules")
      .setDesc("One per line: folder => tag1, tag2. Example: Notes/Work => work, project")
      .addTextArea((t) => {
        t.setPlaceholder("Notes/Work => work, project\nJournal => diary");
        t.setValue(this.plugin.settings.rulesText);
        t.inputEl.style.height = "180px";
        t.onChange(async (v) => {
          this.plugin.settings.rulesText = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Recursive")
      .setDesc("Apply rules to subfolders")
      .addToggle((tg) => {
        tg.setValue(this.plugin.settings.recursive);
        tg.onChange(async (v) => {
          this.plugin.settings.recursive = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Apply now")
      .setDesc("Apply rules to all existing notes")
      .addButton((b) => {
        b.setButtonText("Run").onClick(async () => {
          const notes = this.app.vault.getMarkdownFiles();
          for (const f of notes) await this.plugin.applyToFile(f);
          new Notice("Alyok Autotag: done");
        });
      });
  }
}
