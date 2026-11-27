# 📚 McMaster Book Club Website

Official website for the McMaster Book Club: a static site (HTML, CSS, vanilla JavaScript, no build step).

🌐 **Live site:** https://mcmasterwebsite-da4bp.ondigitalocean.app/

---

## 🧠 How it works

```
Pages CMS (app.pagescms.org)
      │  saves = git commits
data/books.json, data/events.json  (in this repo)
      │  push to main → DigitalOcean redeploys
Static site  ──►  Open Library API (covers, titles, descriptions)
      │
      └─► Google Apps Script  (newsletter signups + trivia only)
```

| Content | Where it lives | How to edit |
|---|---|---|
| Current, upcoming & past books, voting | `data/books.json` | Pages CMS → **Books** |
| Events | `data/events.json` | Pages CMS → **Events** |
| Team members | `data/team.json` + `images/ourteam/` | Pages CMS → **Our Team** |
| Past events & photos | `data/past-events.json` + `images/events/` | Pages CMS → **Past Events** |
| Join page (member card + newsletter) | `join.html`, `js/join.js` | Code |
| Newsletter signups, trivia | Google Sheet via `apps-script/Code.gs` | Sheet / `admin-trivia.html` |

---

## ✏️ Editing content (Pages CMS)

1. Go to **https://app.pagescms.org** and sign in with GitHub.
2. Open the `mcmaster-book-club` repo. (First time only: install the Pages CMS GitHub app on the repo when prompted.)
3. Edit **Books** or **Events** and click **Save**. Each save is a commit to `main`, and the site updates once DigitalOcean redeploys (about 1–2 minutes).

The editor's fields are defined in [`.pages.yml`](.pages.yml).

### 📝 Monthly book update

1. In **Books**, change last month's books from `current` to `past`. Keep the most recent past books near the top of the list.
2. Add the new books with status `current`: ISBN, title, author, month, meeting time and location, tags, discussion prompts.
   - The cover, title, author and description are fetched from Open Library using the ISBN.
   - If the ISBN finds the wrong edition, fill in the Open Library work ID (e.g. `OL20059198W`).
3. Save.

You can add next month's picks early with status `upcoming`: they're saved but not shown.

### 🗳 Voting

In **Books**, turn on **Voting open** and paste the Google Form link. Turn it off when voting ends.

### 📅 Events

Add an event in **Events** with a date. Events disappear from the site automatically the day after their date, so there's nothing to clean up.

---

## 🎭 Our Team

In Pages CMS, open **Our Team**. Each member is one spread in the book, in list order (drag to reorder). Fill in first name, full name, role, photo (a portrait works best), email and Instagram handle; LinkedIn, favourite book and currently reading are optional and only show when filled in. Update **Year shown on the cover** each new exec year. Photos are shrunk automatically after upload, like Past Events photos.

---

## 📸 Past events & photos

Event photos come from the club Drive (McMaster Book Club 2026-2027 → Club Organisation → Photos). Download the ones you want first.

1. In Pages CMS, open **Past Events** and click **Add an entry**. New entries go at the bottom, so drag the new event to the **top** of the list (the page shows the list in order, newest first; chapter numbers count up from the bottom).
2. Fill in **Event name** and **Date shown** (e.g. `Nov 2026`).
3. Under **Photos**, upload up to 15 photos. Aim for a mix of group shots, candids, the activity and snacks if there were any.
4. Drag the photos so the **first three are group photos**: they're the thumbnails on the Past Events page, and the first one is the big one.
   - Optional: add up to three short **Polaroid captions** (big photo first) and a **Handwritten note** under the big photo. Without a note, the page shows how many photos are in the album.
5. Save. The site updates in a couple of minutes.

You don't need to resize anything: after each upload a GitHub Action (`.github/workflows/compress-photos.yml`) shrinks any photo over 1600px or 600 KB and commits the smaller version, so the site redeploys once more a minute or two later. Uploaded photos land in `images/events/`.

---

## ⚙️ Backend (Google Apps Script)

`apps-script/Code.gs` handles newsletter signups (`POST ?path=newsletter`) and trivia uploads and leaderboards (`?action=...`). Its URL is `API_BASE` in `js/api.js`. Setup steps are in [`apps-script/README.md`](apps-script/README.md).

The Sheet's `current`, `past` and `events` tabs are no longer used by the site.

---

## 💻 Local preview

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the HTML files directly won't load the book data, because browsers block `fetch` from `file://`.
