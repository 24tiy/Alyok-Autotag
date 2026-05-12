# Alyok Autotag

![Demo](https://github.com/24tiy/Alyok-Autotag/blob/main/alyok-autotag-demo.gif)

Obsidian community plugin for **automatic tagging of notes** based on their folders, creation date, and user rules.  
Helps keep your vault tidy without manually managing tags.

---

## ✨ Features

- **Folder → Tags rules** — automatically apply tags when a note is inside specific folders.
- **`#new` tag** — mark fresh notes if no rule matched.
- **Automatic retag on move/rename** — tags update when you move a note.
- **Creation timestamp tag** — e.g. `#2025-08-31-14-35`.
- **Optional title stamping** — new notes can be named with timestamp by default.
- **Safe tag block** — tags are written at the bottom, never inside code blocks.
- **Configurable block marker** — default: `<!-- Alyok Autotag -->`.
- **Show untagged folders** — see which folders don't have any tag rules yet.
- **Auto-create rules from folder names** — one click to generate rules where tag = folder name (e.g. folder "Work" → `#Work`). Two modes: only untagged folders, or all folders with overwrite.
- **Apply tags to all notes** — bulk retag every note in folders that have rules.

---

## ⚙️ Settings

- **Mode** (currently only `block`).
- **Add/remove `#new`** on create/rename.
- **Stamp date-time to title on create** — new notes default to timestamp-based names.
- **Block marker** customization.
- **Rules (folder → tags)** with dropdown of existing folders.

### Rules section

- **Show untagged folders** — opens a list of folders that have no tag rules assigned. Useful to spot gaps in your rule setup.
- **Auto-create rules from folder names** — opens a dialog with two options:
  - **Only untagged folders** — creates rules only for folders without existing rules. Each folder gets a tag matching its leaf name.
  - **All folders (overwrite)** — creates or overwrites rules for every folder, replacing any existing tags with the folder name.
- **Apply tags to all notes** — walks through every `.md` file in the vault and rewrites the tag block for all notes in folders covered by rules. Shows a notification with the number of updated notes.

---

## 🚀 Installation

Download the latest release:  
- [Alyok Autotag 1.1.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.1.0) (latest)  
- [Alyok Autotag 1.0.1](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.0.1)  
- [Alyok Autotag 1.0.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.0.0) (initial release)  

1. Unzip the archive.  
2. Copy the folder `alyok-autotag` into your vault's plugins folder:  

```
<vault>/.obsidian/plugins/
```

3. Enable **Alyok Autotag** in Obsidian's *Community plugins* settings.

---

## 📖 Usage

1. Configure rules in settings (folder → tags), or use **Auto-create rules from folder names** to generate them automatically.  
2. Create or move notes — tags are applied automatically.  
3. Look at the bottom of your note for the `<!-- Alyok Autotag -->` block.  
4. Use **Apply tags to all notes** to bulk-update existing notes after changing rules.  
5. Use **Show untagged folders** to check which folders still need rules.

---

## 📜 License

This project is licensed under the terms of the [MIT License](https://github.com/24tiy/Alyok-Autotag/blob/main/LICENSE).

---

## 📦 Changelog

- **[1.1.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.1.0)**  
  - Added **Show untagged folders** button — lists folders without tag rules.  
  - Added **Auto-create rules from folder names** — generates rules where tag = folder name, with option to apply only to untagged folders or overwrite all.  
  - Added **Apply tags to all notes** — bulk retag all existing notes in folders that have rules.  

- **[1.0.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.0.0)**  
  - Initial release with folder → tags rules.  
  - Added `#new` tagging on create.  
  - Auto retagging on move/rename.  
  - Configurable block marker.  
  - Added automatic **date-time tag** in format `#YYYY-MM-DD-HH-MM`.  
  - Added **optional setting**: use date-time as the **default note title** on creation.  
  - UI improvement: folder rules now use a dropdown with existing folders (to avoid typos).  
  - Improved safety: tag block is never inserted into unfinished code blocks (fix for Dataview).
