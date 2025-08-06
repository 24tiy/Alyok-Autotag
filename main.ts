import {
  Plugin,
  TFile,
  TFolder,
  PluginSettingTab,
  Setting
} from "obsidian";

interface FolderTagRule {
  folder: string;
  tags: string[];
}

interface AlyokAutotagSettings {
  rules: FolderTagRule[];
}

const DEFAULT_SETTINGS: AlyokAutotagSettings = {
  rules: []
};

const AUTOTAG_MARKER = "<!-- Alyok Autotag -->";

export default class AlyokAutotagPlugin extends Plugin {
  settings: AlyokAutotagSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AlyokAutotagSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.applyTags(file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.applyTags(file);
        }
      })
    );
  }

  getRuleForPath(path: string): FolderTagRule | null {
    const folder = path.split("/").slice(0, -1).join("/");
    return this.settings.rules.find((r) => folder === r.folder) || null;
  }

  async applyTags(file: TFile) {
    const rule = this.getRuleForPath(file.path);
    const content = await this.app.vault.read(file);

    const tagBlock = rule
      ? `${AUTOTAG_MARKER}\n${rule.tags.map((t) => `#${t}`).join(" ")}`
      : `${AUTOTAG_MARKER}\n#new`;

    let updated = content;

    if (content.includes(AUTOTAG_MARKER)) {
      updated = content.replace(new RegExp(`${AUTOTAG_MARKER}[\\s\\S]*`, "g"), tagBlock);
    } else {
      updated += `\n\n${tagBlock}`;
    }

    await this.app.vault.modify(file, updated);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class AlyokAutotagSettingTab extends PluginSettingTab {
  plugin: AlyokAutotagPlugin;

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Alyok Autotag Settings" });

    const folders = this.app.vault.getAllLoadedFiles()
      .filter((f) => f instanceof TFolder)
      .map((f) => f.path);

    this.plugin.settings.rules.forEach((rule, index) => {
      new Setting(containerEl)
        .setName(`Rule ${index + 1}`)
        .addDropdown(drop => {
          folders.forEach(path => drop.addOption(path, path));
          drop.setValue(rule.folder);
          drop.onChange(async (value) => {
            this.plugin.settings.rules[index].folder = value;
            await this.plugin.saveSettings();
          });
        })
        .addText(text => text
          .setPlaceholder("tag1, tag2")
          .setValue(rule.tags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.rules[index].tags = value.split(",").map((t) => t.trim());
            await this.plugin.saveSettings();
          }))
        .addExtraButton(button => {
          button.setIcon("cross")
            .setTooltip("Delete rule")
            .onClick(async () => {
              this.plugin.settings.rules.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            });
        });
    });

    new Setting(containerEl)
      .addButton(button => {
        button.setButtonText("Add rule")
          .onClick(async () => {
            this.plugin.settings.rules.push({ folder: "", tags: [] });
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }
}
