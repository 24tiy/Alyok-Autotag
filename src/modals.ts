import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";
import { t } from "./i18n";
import type AlyokAutotag from "./main";
import { cleanFolder, folderTag, ruleTags } from "./tags";

export class FolderSuggest extends FuzzySuggestModal<string> {
  constructor(app: App, private items: string[], private onPick: (folder: string) => void | Promise<void>) {
    super(app);
    this.setPlaceholder(t("chooseFolder"));
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

    this.titleEl.setText(t("ruleTitle", { folder: this.folder }));
    new Setting(this.contentEl)
      .setName(t("ruleTags"))
      .setDesc(t("ruleTagsDesc"))
      .addText(text => {
        text.setPlaceholder(t("tagsPlaceholder")).setValue(tags).onChange(v => (tags = v));
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter" && !e.isComposing) void save();
        });
      });
    new Setting(this.contentEl)
      .setName(t("ruleRetag"))
      .setDesc(t("ruleRetagDesc"))
      .addToggle(toggle => toggle.setValue(retag).onChange(v => (retag = v)));
    new Setting(this.contentEl)
      .setName(t("ruleSkip"))
      .setDesc(t("ruleSkipDesc"))
      .addToggle(toggle => toggle.setValue(skip).onChange(v => (skip = v)));
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText(t("cancel")).onClick(() => this.close()))
      .addButton(b => b.setButtonText(t("save")).setCta().onClick(save));
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
    this.titleEl.setText(t("untaggedName"));
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    const folders = this.plugin.foldersWithoutRules();
    if (!folders.length) {
      contentEl.createEl("p", { text: t("untaggedNone") });
      return;
    }
    for (const folder of folders) {
      const inherited = ruleTags(folder, this.plugin.settings.rules);
      const row = new Setting(contentEl)
        .setName(folder)
        .setClass("alyok-inline")
        .setClass("alyok-clickable")
        .addExtraButton(b => b.setIcon("plus").setTooltip(t("menuRule")));
      if (inherited.length) row.setDesc(t("inherits", { tags: inherited.map(tag => "#" + tag).join(" ") }));
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

    this.titleEl.setText(t("autoName"));
    new Setting(contentEl).setName(t("autoStyle")).addDropdown(d =>
      d
        .addOption("leaf", t("autoStyleLeaf"))
        .addOption("nested", t("autoStyleNested"))
        .setValue("leaf")
        .onChange(v => (nested = v === "nested"))
    );
    new Setting(contentEl)
      .setName(t("autoOnlyNew"))
      .addButton(b => b.setButtonText(t("autoCreate")).setCta().onClick(() => run(false)));
    new Setting(contentEl)
      .setName(t("autoAll"))
      .setDesc(t("autoAllDesc"))
      .addButton(b => b.setButtonText(t("autoCreate")).setWarning().onClick(() => run(true)));
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
    this.titleEl.setText(t("applyTitle"));
    this.contentEl.createEl("p", { text: t("applyText") });
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText(t("cancel")).onClick(() => this.close()))
      .addButton(b =>
        b
          .setButtonText(t("apply"))
          .setWarning()
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
