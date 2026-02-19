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

Rename "Sheet1" to `current`. Set up these exact rows:

| A (key)            | B (value)                                      |
|---------------------|-------------------------------------------------|
| `key`              | `value`  ← (this is the header row)             |
| `isbn`             | 9780743273565                                    |
| `work_id`          | OL468431W  *(Open Library work ID, optional)*    |
| `title`            | The Great Gatsby                                |
| `author`           | F. Scott Fitzgerald                             |
| `custom_summary`   | A haunting tale of wealth and lost love…         |
| `tags`             | Fiction, Classic, American Lit                   |
| `meeting_time`     | Thursday, March 5, 2026 — 6:00 PM EST           |
| `meeting_location` | McMaster University, Room TBA / Zoom             |
| `discussion_prompts` | How does Fitzgerald use the green light?\|Is Gatsby sympathetic or deluded?\|How does the 1920s setting shape choices?\|What does Nick reveal about storytelling?\|Is the American Dream still relevant? |
| `goodreads_url`    | https://www.goodreads.com/book/show/4671.The_Great_Gatsby |
| `voting_open`      | FALSE                                           |
| `vote_form_url`    | *(paste Google Form URL when ready, or leave blank)* |

> **Important:** Discussion prompts are separated by `|` (pipe), tags by `,` (comma).
>
> **How book data works:** The website uses the `isbn` (preferred) or `work_id` to fetch the book cover, title, authors, and description automatically from [Open Library](https://openlibrary.org). You only need to change the ISBN when you update the current read — everything else is fetched automatically! The `title`, `author`, and `custom_summary` fields are used as fallbacks if Open Library is unavailable.

### Tab 2: `past`

Create a new tab named `past`. Set up headers and sample rows:

| title              | author           | month     | short_blurb                              |
|--------------------|------------------|-----------|------------------------------------------|
| Normal People      | Sally Rooney     | Jan 2026  | An intimate story of mutual fascination… |
| Educated           | Tara Westover    | Dec 2025  | A memoir about the transformative power…  |
| Circe              | Madeline Miller  | Nov 2025  | A bold reimagining of Greek mythology…    |

### Tab 3: `newsletter`

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

- **Current read:** `YOUR_WEB_APP_URL?path=current`
  → Should return JSON with the book info
- **Past reads:** `YOUR_WEB_APP_URL?path=past`
  → Should return a JSON array of past books

---

## 6. Monthly Update Workflow

Every month, a club exec does this:

### Update the current book:
1. Open the Google Sheet.
2. Go to the `current` tab.
3. Update the **value** column for: `isbn` (required — find the 13-digit ISBN on the book's back cover or Goodreads page), `title`, `author`, `custom_summary`, `tags`, `meeting_time`, `meeting_location`, `discussion_prompts`, `goodreads_url`.
4. Optionally fill in `work_id` (the Open Library Work ID, e.g. `OL468431W`) if the ISBN lookup doesn't find the right book.
5. The website updates automatically — book cover, description, and author info are fetched live from Open Library using the ISBN!

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
| "Error: Unknown path" | Make sure the URL has `?path=current` or `?path=past` |
| Data not updating | The Sheet may be cached. Wait ~30s and refresh. |
| CORS errors in console | Make sure the Web App is deployed with "Anyone" access |
| Newsletter not saving | Check the `newsletter` tab has the 4 header columns exactly |
| Rate-limit error | Same email can only subscribe once per 24 hours |
