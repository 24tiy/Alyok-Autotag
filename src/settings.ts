import { App, PluginSettingTab, Setting, TFolder, debounce } from "obsidian";
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
      .setName("Where to write tags")
      .setDesc("A block at the end of the note or the tags property.")
      .addDropdown(d =>
        d
          .addOption("block", "Block at the end")
          .addOption("properties", "Tags property")
          .setValue(s.mode)
          .onChange(async value => {
            s.mode = value as Mode;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (s.mode === "block") {
      new Setting(containerEl)
        .setName("Block marker")
        .setDesc("The line that starts the block. Blocks with an old marker stay as they are.")
        .addText(text =>
          text.setValue(s.blockMarker).onChange(value => {
            s.blockMarker = value.trim() || DEFAULT_SETTINGS.blockMarker;
            this.save();
          })
        );
    }

    const addNewDesc = () => `Adds #${s.newTag} to a new note when no rule matches its folder.`;
    const removeNewDesc = () => `Removes #${s.newTag} when the note is moved to another folder. Renaming doesn't count.`;

    new Setting(containerEl)
      .setName("Tag for new notes")
      .setDesc("Without the #.")
      .addText(text =>
        text.setPlaceholder(DEFAULT_SETTINGS.newTag).setValue(s.newTag).onChange(value => {
          s.newTag = splitTags(value)[0] || DEFAULT_SETTINGS.newTag;
          addNew.setDesc(addNewDesc());
          removeNew.setDesc(removeNewDesc());
          this.save();
        })
      );

    const addNew = this.toggle("Mark new notes", addNewDesc(), s.addNewOnCreate, v => (s.addNewOnCreate = v));
    const removeNew = this.toggle("Unmark on move", removeNewDesc(), s.removeNewOnRename, v => (s.removeNewOnRename = v));
    this.toggle("Creation time tag", "Adds a tag like #2025-08-31-14-35 to new notes.", s.addStamp, v => (s.addStamp = v));
    this.toggle("Name new notes by time", "An untitled note gets a name like 2025-08-31-14-35.", s.stampTitleOnCreate, v => (s.stampTitleOnCreate = v));

    new Setting(containerEl).setHeading().setName("Rules").setDesc("Notes in a folder and all its subfolders get the tags of its rule.");
    this.renderRules(containerEl.createDiv("alyok-rules"));

    new Setting(containerEl)
      .setName("Rules from folder names")
      .setDesc("Creates a rule for each folder with the folder name as the tag.")
      .addButton(b => b.setButtonText("Create…").onClick(() => new AutoRulesModal(this.app, this.plugin).open()));
    new Setting(containerEl)
      .setName("Folders without rules")
      .setDesc("Folders that don't have their own rule.")
      .addButton(b => b.setButtonText("Show").onClick(() => new UntaggedModal(this.app, this.plugin).open()));
    new Setting(containerEl)
      .setName("Apply to all notes")
      .setDesc("Rewrites tags in every note covered by a rule.")
      .addButton(b => b.setButtonText("Apply…").setWarning().onClick(() => new ApplyModal(this.app, this.plugin).open()));

    new Setting(containerEl).setHeading().setName("Skipped folders").setDesc("Notes in these folders are never touched. Good for templates.");
    for (const folder of s.skipped) {
      new Setting(containerEl)
        .setName(folder)
        .setClass("alyok-inline")
        .addExtraButton(b =>
          b
            .setIcon("x")
            .setTooltip("Remove")
            .onClick(async () => {
              s.skipped = s.skipped.filter(f => f !== folder);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }
    new Setting(containerEl).setName("Add folder").addButton(b =>
      b
        .setIcon("plus")
        .setTooltip("Add folder")
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
      button.createSpan({ text: folder || "Choose folder" });
      button.toggleClass("is-empty", !folder);
      button.toggleClass("is-missing", !!folder && !exists);
      button.setAttr("aria-label", folder && !exists ? "Folder not found" : "Choose folder");
      button.onclick = () =>
        new FolderSuggest(this.app, this.plugin.folders(), async picked => {
          rule.folder = picked;
          await this.plugin.saveSettings();
          this.renderRules(el);
        }).open();

      row.addText(text => {
        text.setPlaceholder("#tag1 #tag2").setValue(rule.tags).onChange(value => {
          rule.tags = value;
          this.save();
        });
        text.inputEl.addClass("alyok-rule-tags");
      });
      row.addExtraButton(b =>
        b
          .setIcon("trash-2")
          .setTooltip("Delete rule")
          .onClick(async () => {
            rules.splice(rules.indexOf(rule), 1);
            await this.plugin.saveSettings();
            this.renderRules(el);
          })
      );
    });

    new Setting(el).setName("Add rule").addButton(b =>
      b
        .setIcon("plus")
        .setTooltip("Add rule")
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
