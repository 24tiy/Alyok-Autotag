# Alyok Autotag

Obsidian community plugin for **automatic tagging of notes** based on their folders, creation date, and user rules.  
Helps keep your vault tidy without manually managing tags.

---

## ✨ Features

- **Folder → Tags rules**  
  Define rules in settings: notes inside a specific folder automatically get the corresponding tags.

- **`#new` tag for fresh notes**  
  New notes created outside of any rule folder can automatically receive a `#new` tag.

- **Automatic retag on move/rename**  
  If a note is moved to another folder, its tags are updated according to the rules.  
  Optionally, the `#new` tag is removed after the first move.

- **Creation timestamp tag**  
  Each note can automatically receive a tag with its creation date/time, e.g.:  
```

\#2025-08-31-14-35

````

- **Optional title stamping**  
If enabled in settings, new notes are named by default with their creation timestamp (e.g. `2025-08-31-14-35.md`).  
You can still append extra text manually.

- **Safe tag block**  
Tags are written into the note as a block at the bottom:  
```markdown
<!-- Alyok Autotag -->
#tag1
#tag2
````

The plugin ensures the block is never inserted inside code blocks (e.g. DataviewJS).

* **Configurable block marker**
  Default is `<!-- Alyok Autotag -->`, but you can customize it.

---

## ⚙️ Settings

* **Mode**
  Currently only `block` mode is supported (tags are written at the bottom of the note).

* **Add #new on create**
  Automatically tag new notes with `#new`.

* **Remove #new on rename**
  Remove the `#new` tag after a note is moved/renamed.

* **Stamp date-time to title on create**
  When enabled, new notes are created with their timestamp as filename.

* **Block marker**
  Change the marker string for the auto-tag block.

* **Rules (folder → tags)**
  Add rules mapping folders to tags.
  The UI provides a **dropdown of existing folders** (with fuzzy search) to avoid typos.

---

## 📸 Screenshots

### Rules with folder dropdown

![Rules dropdown screenshot](./docs/screenshots/rules-dropdown.png)

### Example note with tags

![Note with tags screenshot](./docs/screenshots/note-tags.png)

*(place images into `docs/screenshots/` in the repo; filenames can be adjusted)*

---

## 🚀 Installation

### From source

1. Clone this repository:

   ```bash
   git clone https://github.com/24tiy/Alyok-Autotag.git
   cd Alyok-Autotag
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. Copy the generated `main.js`, `manifest.json`, and `styles.css` into your Obsidian vault at:

   ```
   <vault>/.obsidian/plugins/alyok-autotag/
   ```

5. Enable the plugin in Obsidian’s **Community plugins** tab.

---

## 📖 Usage

1. Define rules in settings (folder → tags).
2. Create or move notes — tags will be applied automatically.
3. Inspect the bottom of your note to see the `<!-- Alyok Autotag -->` block.

---

## ✅ Example

If you create a note in folder `Work/Reports`, and you have this rule:

```
Work/Reports → #work #report
```

Then the note will automatically contain:

```markdown
<!-- Alyok Autotag -->
#work
#report
#2025-08-31-14-35
```

---

## 🛠 Development

* Built with TypeScript.
* Run `npm run dev` for incremental builds.
* Run `npm run build` for production build.

---

## 📜 License

MIT

```
```
