import { App, PluginSettingTab, SettingDefinitionItem, TFolder } from "obsidian";
import type AlyokAutotag from "./main";
import { ApplyModal, AutoRulesModal, FolderSuggest, UntaggedModal } from "./modals";
import { Rule, cleanFolder, folderTag, splitTags } from "./tags";

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

const RULE_KEY = /^rule:(\d+)$/;

export class SettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AlyokAutotag) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    const rule = RULE_KEY.exec(key);
    if (rule) return s.rules[Number(rule[1])]?.tags ?? "";
    return key in s ? s[key as keyof Settings] : undefined;
  }

  async setControlValue(key: string, value: unknown) {
    const s = this.plugin.settings;
    const rule = RULE_KEY.exec(key);
    if (rule) {
      const target = s.rules[Number(rule[1])];
      if (target) target.tags = String(value);
    } else if (key === "mode") {
      s.mode = value === "properties" ? "properties" : "block";
    } else if (key === "blockMarker") {
      s.blockMarker = String(value).trim() || DEFAULT_SETTINGS.blockMarker;
    } else if (key === "newTag") {
      s.newTag = splitTags(String(value))[0] || DEFAULT_SETTINGS.newTag;
    } else if (key === "addNewOnCreate" || key === "removeNewOnRename" || key === "addStamp" || key === "stampTitleOnCreate") {
      s[key] = value === true;
    }
    await this.plugin.saveSettings();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    const changed = async () => {
      await this.plugin.saveSettings();
      this.update();
    };
    const pickFolder = (pick: (folder: string) => void) =>
      new FolderSuggest(this.app, this.plugin.folders(), async folder => {
        pick(folder);
        await changed();
      }).open();

    return [
      {
        name: "Where to write tags",
        desc: "A block at the end of the note or the tags property.",
        control: { type: "dropdown", key: "mode", options: { block: "Block at the end", properties: "Tags property" } },
      },
      {
        name: "Block marker",
        desc: "The line that starts the block. Blocks with an old marker stay as they are.",
        visible: () => s.mode === "block",
        control: { type: "text", key: "blockMarker", placeholder: DEFAULT_SETTINGS.blockMarker },
      },
      {
        name: "Mark new notes",
        desc: "Tags a new note when no rule matches its folder.",
        control: { type: "toggle", key: "addNewOnCreate" },
      },
      {
        name: "Tag for new notes",
        desc: "Without the #.",
        control: {
          type: "text",
          key: "newTag",
          placeholder: DEFAULT_SETTINGS.newTag,
          validate: value => (splitTags(value).length > 1 ? "One tag, without spaces." : undefined),
        },
      },
      {
        name: "Unmark on move",
        desc: "Removes that tag when the note is moved to another folder. Renaming doesn't count.",
        control: { type: "toggle", key: "removeNewOnRename" },
      },
      {
        name: "Creation time tag",
        desc: "Adds a tag like #2025-08-31-14-35 to new notes.",
        control: { type: "toggle", key: "addStamp" },
      },
      {
        name: "Name new notes by time",
        desc: "An untitled note gets a name like 2025-08-31-14-35.",
        control: { type: "toggle", key: "stampTitleOnCreate" },
      },
      {
        type: "list",
        heading: "Rules",
        emptyState: "No rules yet. Notes in a folder and all its subfolders get the tags of its rule.",
        addItem: {
          name: "Add rule",
          action: () =>
            pickFolder(folder => {
              if (!s.rules.some(rule => cleanFolder(rule.folder) === folder)) s.rules.push({ folder, tags: "#" + folderTag(folder, false) });
            }),
        },
        onDelete: index => {
          s.rules.splice(index, 1);
          void changed();
        },
        items: s.rules.map((rule, index) => ({
          name: rule.folder,
          desc: this.app.vault.getAbstractFileByPath(cleanFolder(rule.folder)) instanceof TFolder ? undefined : "Folder not found",
          control: { type: "text", key: `rule:${index}`, placeholder: "#tag1 #tag2" },
        })),
      },
      {
        type: "group",
        items: [
          {
            name: "Rules from folder names",
            desc: "Creates a rule for each folder with the folder name as the tag.",
            action: () => new AutoRulesModal(this.app, this.plugin).open(),
          },
          {
            name: "Folders without rules",
            desc: "Folders that don't have their own rule.",
            action: () => new UntaggedModal(this.app, this.plugin).open(),
          },
          {
            name: "Apply to all notes",
            desc: "Rewrites tags in every note covered by a rule.",
            action: () => new ApplyModal(this.app, this.plugin).open(),
          },
        ],
      },
      {
        type: "list",
        heading: "Skipped folders",
        emptyState: "Notes in these folders are never touched. Good for templates.",
        addItem: {
          name: "Add folder",
          action: () =>
            pickFolder(folder => {
              if (!s.skipped.includes(folder)) s.skipped.push(folder);
            }),
        },
        onDelete: index => {
          s.skipped.splice(index, 1);
          void changed();
        },
        items: s.skipped.map(folder => ({ name: folder })),
      },
    ];
  }
}
