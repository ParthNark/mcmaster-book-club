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
| Team members | `our-team.html` (`teamMembers` list) | Code |
| Past event photos | `images/events/<event>/` + `js/chapters-data.js` | Code (see below) |
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

## 📸 Past event photos

Event photos come from the club Drive (McMaster Book Club 2026-2027 → Club Organisation → Photos).

1. Pick up to 15 photos per event, resized to at most 1600px on the long side (JPEG quality ~80). Full-size camera photos make the page slow.
2. Save them as `01.jpg`, `02.jpg`, … in a new folder under `images/events/`.
3. Add the event to `CHAPTER_CONFIG` in `scripts/update-chapters-data.js`. The list is oldest first and chapter numbers follow that order; the page shows the newest chapter at the top. List up to 3 group photos in `featured` to use as the chapter's thumbnails (the first is the large one).
4. Run `node scripts/update-chapters-data.js` to regenerate `js/chapters-data.js`, then commit.

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
