# Alyok Autotag ✨
A stylish and configurable Obsidian plugin that automatically adds tags at the bottom of your notes based on which folder they're in — with full support for custom colors and rules.

---

## 💡 What it does

- 🗂️ You define folder → tag mappings
- 📌 When a note is moved into a mapped folder, the tags are added at the bottom of the file
- 🎨 You can assign a custom color for each tag using a built-in color picker
- ✨ If a note is outside all mapped folders, it gets the `#new` tag automatically
- 🧹 Previous tags inserted by the plugin are automatically replaced or removed

---

## ⚙️ Example use

| Folder              | Tags              | Color    |
|---------------------|-------------------|----------|
| `Work/Important`    | `#work #urgent`   | `#FF0000`|
| `Journal/Personal`  | `#private #mood`  | `#3366ff`|
| *(unmapped folder)* | `#new` *(auto)*   | `gray`   |

These will render in your note as:

```html
<!-- Alyok Autotag -->
<span style="color:#FF0000">#work</span>
<span style="color:#FF0000">#urgent</span>
````

---

## 📂 How to install

1. Download the latest `main.js`, `manifest.json`, and `styles.css` from the plugin's GitHub [Releases](https://github.com/24tiy/alyok-autotag/releases)
2. Create a folder named `alyok-autotag` inside your Obsidian vault under `.obsidian/plugins/`
3. Place the files there
4. Enable the plugin in Obsidian under **Settings → Community plugins**

---

## 🧪 Planned features

* [ ] Per-tag font styling (italic, bold, underline)
* [ ] Auto-generated `styles.css` from config
* [ ] Preview color dot in settings

---

## 💜 Made by [24tiy](https://github.com/24tiy)

