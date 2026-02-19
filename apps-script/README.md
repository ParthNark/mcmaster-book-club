# McMaster Book Club — Google Apps Script Backend

Step-by-step setup guide for club executives. **No coding required** after initial setup.

---

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Rename it to something like **"McMaster Book Club Data"**.
3. Note the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_IS_THIS_PART/edit
   ```

### Tab 1: `current`

Rename "Sheet1" to `current`. Set up these exact rows using **namespaced keys** for two books:

| A (key)                 | B (value)                                      |
|-------------------------|-------------------------------------------------|
| `key`                   | `value`  ← (this is the header row)             |
| `book1_isbn`            | 9780743273565                                    |
| `book1_work_id`         | OL468431W  *(Open Library work ID, optional)*    |
| `book1_title`           | The Great Gatsby                                |
| `book1_author`          | F. Scott Fitzgerald                             |
| `book1_custom_summary`  | A haunting tale of wealth and lost love…         |
| `book1_tags`            | Fiction, Classic, American Lit                   |
| `book1_meeting_time`    | Thursday, March 5, 2026 — 6:00 PM EST           |
| `book1_meeting_location`| McMaster University, Blue Lounge                 |
| `book1_meeting_notes`   | *(optional — extra info for the meeting card)*   |
| `book1_discussion_prompts` | How does Fitzgerald use the green light?\|Is Gatsby sympathetic or deluded?\|What does Nick reveal about storytelling? |
| `book1_goodreads_url`   | https://www.goodreads.com/book/show/4671.The_Great_Gatsby |
| `book2_isbn`            | 9780735219090                                    |
| `book2_work_id`         | *(optional)*                                     |
| `book2_title`           | Where the Crawdads Sing                          |
| `book2_author`          | Delia Owens                                      |
| `book2_custom_summary`  | A mystery set in the marshes of North Carolina…  |
| `book2_tags`            | Fiction, Mystery, Nature                         |
| `book2_meeting_time`    | Thursday, March 19, 2026 — 6:00 PM EST          |
| `book2_meeting_location`| McMaster University, Blue Lounge                 |
| `book2_meeting_notes`   | *(optional)*                                     |
| `book2_discussion_prompts` | How does isolation shape Kya?\|What role does nature play? |
| `book2_goodreads_url`   | https://www.goodreads.com/book/show/36809135     |
| `voting_open`           | FALSE                                            |
| `vote_form_url`         | *(paste Google Form URL when ready, or leave blank)* |

> **Important:** Each book uses a `book1_` or `book2_` prefix. Discussion prompts are separated by `|` (pipe), tags by `,` (comma). The `voting_open` and `vote_form_url` keys are global (no prefix).
>
> **How book data works:** The website uses the `isbn` (preferred) or `work_id` to fetch the book cover, title, authors, and description automatically from [Open Library](https://openlibrary.org). You only need to change the ISBNs when you update the current reads — everything else is fetched automatically! The `title`, `author`, and `custom_summary` fields are used as fallbacks if Open Library is unavailable.

### Tab 2: `past`

Create a new tab named `past`. Set up headers and sample rows:

| title              | author           | month     | short_blurb                              |
|--------------------|------------------|-----------|------------------------------------------|
| Normal People      | Sally Rooney     | Jan 2026  | An intimate story of mutual fascination… |
| Educated           | Tara Westover    | Dec 2025  | A memoir about the transformative power…  |
| Circe              | Madeline Miller  | Nov 2025  | A bold reimagining of Greek mythology…    |

### Tab 3: `events`

Create a new tab named `events`. Set up headers and sample rows:

| title                     | date       | time      | location                          | description                                    | instagram_embed_url                              | rsvp_url                           |
|---------------------------|------------|-----------|-----------------------------------|-------------------------------------------------|---------------------------------------------------|------------------------------------|
| March Book Swap           | 2026-03-15 | 5:00 PM   | McMaster University, Blue Lounge  | Bring a book you've loved — leave with a new one! | https://www.instagram.com/p/ABC123/               | https://forms.gle/example123       |
| Author Q&A: Sally Rooney  | 2026-04-02 | 7:00 PM   | Online (Zoom)                     | Live Q&A with the author of Normal People        |                                                   |                                    |

> Both `instagram_embed_url` and `rsvp_url` are optional. The website shows buttons for them when filled in. Events with past dates still display — remove the row when you want to hide an event.

### Tab 4: `newsletter`

Create a new tab named `newsletter`. Set up the header row only:

| timestamp | email | source_page | user_agent |
|-----------|-------|-------------|------------|

> Rows will be appended automatically when visitors subscribe.

---

## 2. Create the Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**.
2. Delete any existing code in `Code.gs`.
3. Copy the entire contents of `apps-script/Code.gs` from this project and paste it in.
4. At the top of the script, find this line:
   ```js
   const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
   ```
   Replace `PASTE_YOUR_SHEET_ID_HERE` with your actual Sheet ID from Step 1.
5. Click **Save** (💾).

---

## 3. Deploy as a Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Click the ⚙️ gear icon and select **Web app**.
3. Fill in:
   - **Description:** `McMaster Book Club API v1`
   - **Execute as:** `Me` (your Google account)
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. You may be asked to authorize — click through the prompts.
6. Copy the **Web App URL**. It will look like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

## 4. Connect to Your Website

1. Open `js/api.js` in your website files.
2. Find this line:
   ```js
   var API_BASE = "PASTE_WEB_APP_URL_HERE";
   ```
3. Replace `PASTE_WEB_APP_URL_HERE` with the Web App URL from Step 3.
4. Save and commit/push the file.

---

## 5. Test the Endpoints

Open these in your browser to verify:

- **Current reads:** `YOUR_WEB_APP_URL?path=current`
  → Should return JSON with `{ books: [...], voting_open, vote_form_url }`
- **Past reads:** `YOUR_WEB_APP_URL?path=past`
  → Should return a JSON array of past books
- **Events:** `YOUR_WEB_APP_URL?path=events`
  → Should return a JSON array of upcoming events

---

## 6. Monthly Update Workflow

Every month, a club exec does this:

### Update the current books:
1. Open the Google Sheet.
2. Go to the `current` tab.
3. Update the **value** column for both books:
   - **Book 1:** `book1_isbn` (required), `book1_title`, `book1_author`, `book1_custom_summary`, `book1_tags`, `book1_meeting_time`, `book1_meeting_location`, `book1_meeting_notes`, `book1_discussion_prompts`, `book1_goodreads_url`.
   - **Book 2:** Same fields with `book2_` prefix.
4. Optionally fill in `book1_work_id` / `book2_work_id` (Open Library Work ID) if the ISBN lookup doesn't find the right book.
5. The website updates automatically — covers, descriptions, and author info are fetched live from Open Library!

### Update events:
1. Go to the `events` tab.
2. Add a new row for each upcoming event with title, date (YYYY-MM-DD), time, location, and description.
3. Optionally add an Instagram post URL and/or RSVP form URL.
4. Remove rows for past events you no longer want to display.

### Move the old book to past reads:
1. Go to the `past` tab.
2. Add a new row at the top with the old book's title, author, month, and blurb.

### Enable/disable voting:
1. Go to the `current` tab.
2. Set `voting_open` to `TRUE`.
3. Paste your Google Form URL into `vote_form_url`.
4. When voting ends, set `voting_open` back to `FALSE`.

---

## 7. Re-deploying After Code Changes

If you ever edit `Code.gs`:

1. Go to **Deploy → Manage deployments**.
2. Click the ✏️ edit icon on your deployment.
3. Set **Version** to `New version`.
4. Click **Deploy**.

> The Web App URL stays the same — no need to update `api.js`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Error: Unknown path" | Make sure the URL has `?path=current`, `?path=past`, or `?path=events` |
| Data not updating | The Sheet may be cached. Wait ~30s and refresh. |
| CORS errors in console | Make sure the Web App is deployed with "Anyone" access |
| Newsletter not saving | Check the `newsletter` tab has the 4 header columns exactly |
| Rate-limit error | Same email can only subscribe once per 24 hours |
| Only one book showing | Make sure both `book1_` and `book2_` prefixed keys exist in the `current` tab |
| Events not loading | Check the `events` tab exists and has the correct header columns |
