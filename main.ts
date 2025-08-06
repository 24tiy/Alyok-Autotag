import {
  Plugin,
  TFile,
  App,
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

    this.registerEvent(
      this.app.vault.on("rename", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.processFile(file);
        }
      })
    );

    this.addSettingTab(new AlyokAutotagSettingTab(this.app, this));
  }

  async processFile(file: TFile) {
    const folder = file.path.split("/").slice(0, -1).join("/");
    const rule = this.settings.rules.find(r => r.folder === folder);
    if (!rule) return;

    let content = await this.app.vault.read(file);
    const newTags = rule.tags.map(t => `#${t}`).join(" ");
    const tagBlock = `${AUTOTAG_MARKER}\n${newTags}`;

    if (content.includes(AUTOTAG_MARKER)) {
      content = content.replace(new RegExp(`${AUTOTAG_MARKER}[\\s\\S]*`, "g"), tagBlock);
    } else {
      content += `\n\n${tagBlock}`;
    }

    await this.app.vault.modify(file, content);
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

  constructor(app: App, plugin: AlyokAutotagPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Alyok Autotag Settings" });

    this.plugin.settings.rules.forEach((rule, index) => {
      new Setting(containerEl)
        .setName(`Rule ${index + 1}`)
        .addText(text => text
          .setPlaceholder("folder path")
          .setValue(rule.folder)
          .onChange(async (value) => {
            this.plugin.settings.rules[index].folder = value;
            await this.plugin.saveSettings();
          }))
        .addText(text => text
          .setPlaceholder("tag1, tag2")
          .setValue(rule.tags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.rules[index].tags = value.split(",").map(t => t.trim());
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
