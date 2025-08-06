# Alyok Autotag

Automatically adds tags to notes in Obsidian based on the folder they're in.

## 🔧 How it works

Alyok Autotag watches for:

- 🆕 New notes
- 🚚 Notes moved between folders

And then:

- If a note is **created in a folder with a rule** → adds the tags defined in the rule
- If a note is **created outside all configured folders** → adds the tag `#new`
- If a note is **moved into a folder with a rule** → updates the tags accordingly
- If a note is **moved out of a rule-defined folder** → replaces tags with `#new`

Tags are added to the **bottom of the note**, under this marker:
## ⚙️ Settings

- You can define rules in the plugin settings:
  - **Choose folders** from your vault using a dropdown list
  - Assign one or more tags to each folder

## 🧩 Example

| Folder          | Tags added       |
|-----------------|------------------|
| `TODO/`         | `#todo`          |
| `Projects/Work` | `#work #project` |
| *(any other)*   | `#new`           |

## 📦 Installation (manual)

1. Go to `.obsidian/plugins/`
2. Create a folder `alyok-autotag`
3. Place these files inside:
   - `main.js`
   - `manifest.json`
4. Restart Obsidian
5. Enable the plugin in **Settings → Community Plugins**

## 👤 Author

Made with ♥ by [24tiy](https://github.com/24tiy)
