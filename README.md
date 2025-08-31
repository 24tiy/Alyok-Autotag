# Alyok Autotag

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

---

## ⚙️ Settings

- **Mode** (currently only `block`).
- **Add/remove `#new`** on create/rename.
- **Stamp date-time to title on create** — new notes default to timestamp-based names.
- **Block marker** customization.
- **Rules (folder → tags)** with dropdown of existing folders.

---

## 📸 Screenshots

### Rules with folder dropdown
![Rules dropdown screenshot](./docs/screenshots/rules-dropdown.png)

### Example note with tags
![Note with tags screenshot](./docs/screenshots/note-tags.png)

---

## 🚀 Installation

Download the latest release: [Alyok Autotag 1.0.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.0.0)

1. Unzip the archive.  
2. Copy the folder `alyok-autotag` into your vault’s plugins folder:  
```

<vault>/.obsidian/plugins/

```
3. Enable **Alyok Autotag** in Obsidian’s *Community plugins* settings.

---

## 📖 Usage

1. Configure rules in settings (folder → tags).  
2. Create or move notes — tags are applied automatically.  
3. Look at the bottom of your note for the `<!-- Alyok Autotag -->` block.

---

## 📜 License

This project is licensed under the terms of the [MIT License](https://github.com/24tiy/Alyok-Autotag/blob/main/LICENSE).

---

## 📦 Changelog

- **[1.0.0](https://github.com/24tiy/Alyok-Autotag/releases/tag/1.0.0)** — Initial release with rules, `#new` tag, timestamp tag, safe block writing, and optional title stamping.
```
