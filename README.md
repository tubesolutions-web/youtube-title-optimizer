# Tube Solutions

A web app + Chrome extension toolkit for YouTube creators. Helps with title optimization, competitor research, video tracking, bookmarks, thumbnail analysis, niche discovery, and automating repetitive Studio tasks.

---

## Web App (`index.html`)

Hosted on GitHub Pages. A single-page tool with a persistent sidebar and multiple pages:

| Page | What it does |
|---|---|
| **Title Generator** | Generates optimized YouTube titles based on your channel niche and competitors |
| **Idea Generator** | Suggests video ideas based on your channel's content strategy |
| **Tracker** | Track competitor channels — monitor their latest videos, view counts, and outlier performance |
| **Bookmarks** | Save and organize videos into folders for later reference |
| **Thumbnail Generator** | Generate and preview thumbnail concepts |
| **Thumbnail Preview** | See how your thumbnail looks in the YouTube feed |
| **Niche Finder** | Discover untapped YouTube niches using analytics data |

### Sidebar behavior
- **Title / Idea pages**: shows your saved channels
- **Tracker**: shows your tracker groups
- **Bookmarks**: shows your folders
- **Thumbnail / Niche pages**: minimal sidebar (settings only)

---

## Chrome Extension (`chrome-extension/`)

Loaded as an unpacked extension in Chrome. Runs on YouTube and YouTube Studio.

### Features

#### Aged Channel Checker
Runs on `youtube.com`. Detects whether a YouTube channel is newly created ("Zero channel") or established ("Aged channel") based on its join date, and shows a badge on the channel page.

#### Video Tracker & Bookmarks
Runs on `youtube.com`. Injects **Bookmark** and **Track** buttons on video thumbnails and the watch page. Lets you save videos to folders or add them to a tracker group to monitor performance over time.

#### Studio EP Numbers
Runs on `studio.youtube.com`. Automatically reads the episode number from your video filename (e.g. `EP.19 - video-name.mp4`) and displays an editable **EP badge** next to each video in your content list. Keeps your episode numbering organized without manual entry.

#### Auto Description
Runs on `studio.youtube.com`. Automatically fills in the description field when you open a video for editing. You set up a template per channel in the extension popup — it detects which channel you're on and fills the right template instantly. Templates are synced across all your devices via Chrome Sync.

### Popup
Click the extension icon to:
- **Toggle each feature on/off** — changes take effect immediately on the current page, no refresh needed
- **Manage description templates** — add, edit, or delete per-channel templates
- All settings sync across devices automatically

### Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config, permissions, content script rules |
| `background.js` | Service worker |
| `aged-checker.js` | Aged channel badge logic |
| `trackers.js` | Bookmark + tracker button injection |
| `trackers.css` | Styles for tracker/bookmark UI |
| `studio-ep-numbers.js` | EP number badge injection in Studio |
| `auto-description.js` | Auto-fill description on Studio video edit pages |
| `popup.html` / `popup.js` | Extension popup UI |
| `website-bridge.js` | Bridge between the web app and the extension |

---

## Setup

### Web App
Visit the GitHub Pages URL. No installation needed.

### Chrome Extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder
5. Click the Tube Solutions icon in your toolbar to configure

---

## Permissions used
- `storage` — save settings and sync across devices
- `tabs` — detect active tab URL for popup actions
- `scripting` — inject scripts programmatically
- `clipboardWrite` — copy video links
- Access to `youtube.com`, `studio.youtube.com`, and the GitHub Pages host
