# Alyok Autotag

Automatically adds or updates tags in a note depending on the folder it’s in.

## 🔍 What It Does

When you move a note into a folder, this plugin automatically adds tags to the note based on that folder.

The tags are placed at the bottom of the note after a marker like this:

```md
<!-- Alyok Autotag -->
#your-tag
If such a block already exists, it will be replaced. Manually added tags elsewhere in the note remain untouched.

If a note is created outside of the tracked folders, a default tag (e.g. #new) is added.

⚙️ Features
Folder-to-tag mappings (you choose which folders trigger which tags)

Optional tag colors (just for display in the plugin settings)

Automatic replacement of plugin-added tags on note move

Preserves any manual tags in the rest of the note

🧪 Compatibility
Tested on macOS with Obsidian v1.5.8

Likely works on Windows and Linux (community testing welcome)

🛠 Installation
Option 1: Community Plugins (when approved)
Open Settings → Community Plugins

Click Browse and search for Alyok Autotag

Click Install, then Enable

Option 2: Manual Installation
Download the latest release from the Releases page

Extract the files main.js, manifest.json, and README.md

Place them in .obsidian/plugins/alyok-autotag inside your vault

📄 License
MIT License — see LICENSE
