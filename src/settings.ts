import { App, PluginSettingTab, Setting, TFolder, debounce } from "obsidian";
import { t } from "./i18n";
import type AlyokAutotag from "./main";
import { ApplyModal, AutoRulesModal, FolderSuggest, UntaggedModal } from "./modals";
import { Rule, cleanFolder, splitTags } from "./tags";

export type Mode = "block" | "properties";

export interface Settings {
  mode: Mode;
  rules: Rule[];
  skipped: string[];
  newTag: string;
  addNewOnCreate: boolean;
  removeNewOnRename: boolean;
  blockMarker: string;
  addStamp: boolean;
  stampTitleOnCreate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: "block",
  rules: [],
  skipped: [],
  newTag: "new",
  addNewOnCreate: true,
  removeNewOnRename: true,
  blockMarker: "<!-- Alyok Autotag -->",
  addStamp: false,
  stampTitleOnCreate: false,
};

export class SettingTab extends PluginSettingTab {
  private save = debounce(() => this.plugin.saveSettings(), 500, true);

  constructor(app: App, private plugin: AlyokAutotag) {
    super(app, plugin);
  }

  hide() {
    void this.save.run();
    super.hide();
  }

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("modeName"))
      .setDesc(t("modeDesc"))
      .addDropdown(d =>
        d
          .addOption("block", t("modeBlock"))
          .addOption("properties", t("modeProperties"))
          .setValue(s.mode)
          .onChange(async value => {
            s.mode = value as Mode;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (s.mode === "block") {
      new Setting(containerEl)
        .setName(t("markerName"))
        .setDesc(t("markerDesc"))
        .addText(text =>
          text.setValue(s.blockMarker).onChange(value => {
            s.blockMarker = value.trim() || DEFAULT_SETTINGS.blockMarker;
            this.save();
          })
        );
    }

    new Setting(containerEl)
      .setName(t("newTagName"))
      .setDesc(t("newTagDesc"))
      .addText(text =>
        text.setPlaceholder(DEFAULT_SETTINGS.newTag).setValue(s.newTag).onChange(value => {
          s.newTag = splitTags(value)[0] || DEFAULT_SETTINGS.newTag;
          addNew.setDesc(t("addNewDesc", { tag: s.newTag }));
          removeNew.setDesc(t("removeNewDesc", { tag: s.newTag }));
          this.save();
        })
      );

    const addNew = this.toggle(t("addNewName"), t("addNewDesc", { tag: s.newTag }), s.addNewOnCreate, v => (s.addNewOnCreate = v));
    const removeNew = this.toggle(t("removeNewName"), t("removeNewDesc", { tag: s.newTag }), s.removeNewOnRename, v => (s.removeNewOnRename = v));
    this.toggle(t("stampName"), t("stampDesc"), s.addStamp, v => (s.addStamp = v));
    this.toggle(t("titleName"), t("titleDesc"), s.stampTitleOnCreate, v => (s.stampTitleOnCreate = v));

    new Setting(containerEl).setHeading().setName(t("rulesHeading")).setDesc(t("rulesDesc"));
    this.renderRules(containerEl.createDiv("alyok-rules"));

    new Setting(containerEl)
      .setName(t("autoName"))
      .setDesc(t("autoDesc"))
      .addButton(b => b.setButtonText(t("autoButton")).onClick(() => new AutoRulesModal(this.app, this.plugin).open()));
    new Setting(containerEl)
      .setName(t("untaggedName"))
      .setDesc(t("untaggedDesc"))
      .addButton(b => b.setButtonText(t("untaggedButton")).onClick(() => new UntaggedModal(this.app, this.plugin).open()));
    new Setting(containerEl)
      .setName(t("applyName"))
      .setDesc(t("applyDesc"))
      .addButton(b => b.setButtonText(t("applyButton")).setWarning().onClick(() => new ApplyModal(this.app, this.plugin).open()));

    new Setting(containerEl).setHeading().setName(t("skippedHeading")).setDesc(t("skippedDesc"));
    for (const folder of s.skipped) {
      new Setting(containerEl)
        .setName(folder)
        .setClass("alyok-inline")
        .addExtraButton(b =>
          b
            .setIcon("x")
            .setTooltip(t("removeSkipped"))
            .onClick(async () => {
              s.skipped = s.skipped.filter(f => f !== folder);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }
    new Setting(containerEl).setName(t("addSkipped")).addButton(b =>
      b
        .setIcon("plus")
        .setTooltip(t("addSkipped"))
        .onClick(() =>
          new FolderSuggest(this.app, this.plugin.folders(), async folder => {
            if (!s.skipped.includes(folder)) s.skipped.push(folder);
            await this.plugin.saveSettings();
            this.display();
          }).open()
        )
    );
  }

  private toggle(name: string, desc: string, value: boolean, set: (v: boolean) => void): Setting {
    return new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle(toggle =>
        toggle.setValue(value).onChange(async v => {
          set(v);
          await this.plugin.saveSettings();
        })
      );
  }

  private renderRules(el: HTMLElement) {
    el.empty();
    const rules = this.plugin.settings.rules;
    rules.forEach(rule => {
      const row = new Setting(el).setClass("alyok-rule");
      const folder = cleanFolder(rule.folder);
      const exists = this.app.vault.getAbstractFileByPath(folder) instanceof TFolder;
      const button = row.controlEl.createEl("button", { cls: "alyok-rule-folder" });
      button.createSpan({ text: folder || t("chooseFolder") });
      button.toggleClass("is-empty", !folder);
      button.toggleClass("is-missing", !!folder && !exists);
      button.setAttr("aria-label", folder && !exists ? t("folderMissing") : t("chooseFolder"));
      button.onclick = () =>
        new FolderSuggest(this.app, this.plugin.folders(), async picked => {
          rule.folder = picked;
          await this.plugin.saveSettings();
          this.renderRules(el);
        }).open();

      row.addText(text => {
        text.setPlaceholder(t("tagsPlaceholder")).setValue(rule.tags).onChange(value => {
          rule.tags = value;
          this.save();
        });
        text.inputEl.addClass("alyok-rule-tags");
      });
      row.addExtraButton(b =>
        b
          .setIcon("trash-2")
          .setTooltip(t("deleteRule"))
          .onClick(async () => {
            rules.splice(rules.indexOf(rule), 1);
            await this.plugin.saveSettings();
            this.renderRules(el);
          })
      );
    });

    new Setting(el).setName(t("addRule")).addButton(b =>
      b
        .setIcon("plus")
        .setTooltip(t("addRule"))
        .onClick(() =>
          new FolderSuggest(this.app, this.plugin.folders(), async folder => {
            rules.push({ folder, tags: "" });
            await this.plugin.saveSettings();
            this.renderRules(el);
            const inputs = el.querySelectorAll<HTMLInputElement>(".alyok-rule-tags");
            inputs[inputs.length - 1]?.focus();
          }).open()
        )
    );
  }
}
