import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";
import type AlyokAutotag from "./main";
import { cleanFolder, folderTag, ruleTags } from "./tags";

export class FolderSuggest extends FuzzySuggestModal<string> {
  constructor(app: App, private items: string[], private onPick: (folder: string) => void | Promise<void>) {
    super(app);
    this.setPlaceholder("Choose folder");
  }

  getItems() {
    return this.items;
  }

  getItemText(item: string) {
    return item;
  }

  onChooseItem(item: string) {
    void this.onPick(item);
  }
}

export class FolderRuleModal extends Modal {
  constructor(app: App, private plugin: AlyokAutotag, private folder: string, private onSave?: () => void) {
    super(app);
  }

  onOpen() {
    const s = this.plugin.settings;
    const rule = s.rules.find(r => cleanFolder(r.folder) === this.folder);
    let tags = rule ? rule.tags : "#" + folderTag(this.folder, false);
    let skip = s.skipped.includes(this.folder);
    let retag = true;
    const save = async () => {
      await this.plugin.setFolderRule(this.folder, tags, skip, retag);
      this.onSave?.();
      this.close();
    };

    this.titleEl.setText(`Rule for ${this.folder}`);
    new Setting(this.contentEl)
      .setName("Tags")
      .setDesc("Leave empty to delete the rule.")
      .addText(text => {
        text.setPlaceholder("#tag1 #tag2").setValue(tags).onChange(v => (tags = v));
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter" && !e.isComposing) void save();
        });
      });
    new Setting(this.contentEl)
      .setName("Retag notes already here")
      .setDesc("Applies the rule to the notes that are in this folder now.")
      .addToggle(toggle => toggle.setValue(retag).onChange(v => (retag = v)));
    new Setting(this.contentEl)
      .setName("Skip this folder")
      .setDesc("Notes here never get tags.")
      .addToggle(toggle => toggle.setValue(skip).onChange(v => (skip = v)));
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText("Save").setCta().onClick(save));
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class UntaggedModal extends Modal {
  constructor(app: App, private plugin: AlyokAutotag) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Folders without rules");
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    const folders = this.plugin.foldersWithoutRules();
    if (!folders.length) {
      contentEl.createEl("p", { text: "Every folder has a rule." });
      return;
    }
    for (const folder of folders) {
      const inherited = ruleTags(folder, this.plugin.settings.rules);
      const row = new Setting(contentEl)
        .setName(folder)
        .setClass("alyok-inline")
        .setClass("alyok-clickable")
        .addExtraButton(b => b.setIcon("plus").setTooltip("Autotag rule"));
      if (inherited.length) row.setDesc(`Inherits ${inherited.map(tag => "#" + tag).join(" ")}`);
      row.settingEl.addEventListener("click", () => new FolderRuleModal(this.app, this.plugin, folder, () => this.render()).open());
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class AutoRulesModal extends Modal {
  constructor(app: App, private plugin: AlyokAutotag) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    let nested = false;
    const run = async (overwrite: boolean) => {
      await this.plugin.createRules(nested, overwrite);
      this.close();
    };

    this.titleEl.setText("Rules from folder names");
    new Setting(contentEl).setName("Tag").addDropdown(d =>
      d
        .addOption("leaf", "Folder name: #Design")
        .addOption("nested", "Full path: #Projects/Work/Design")
        .setValue("leaf")
        .onChange(v => (nested = v === "nested"))
    );
    new Setting(contentEl)
      .setName("Only folders without a rule")
      .addButton(b => b.setButtonText("Create").setCta().onClick(() => run(false)));
    new Setting(contentEl)
      .setName("All folders")
      .setDesc("Replaces tags in existing rules.")
      .addButton(b => b.setButtonText("Create").setDestructive().onClick(() => run(true)));
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class ApplyModal extends Modal {
  constructor(app: App, private plugin: AlyokAutotag) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Apply rules to all notes?");
    this.contentEl.createEl("p", { text: "Tags will be rewritten in every note covered by a rule. Skipped folders stay as they are." });
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b =>
        b
          .setButtonText("Apply")
          .setDestructive()
          .setCta()
          .onClick(() => {
            this.close();
            this.plugin.applyToAll();
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
