# 📚 McMaster Book Club Website

Official website for the McMaster Book Club.  
Built as a dynamic static site powered by Google Sheets as a lightweight CMS.

🌐 **Live Site:**  
https://mcmasterwebsite-da4bp.ondigitalocean.app/

---

## 🚀 Overview

This project combines a static frontend with a dynamic backend powered by:

- **Google Sheets** – Content management system
- **Google Apps Script** – API layer
- **Open Library API** – Book metadata & covers
- **DigitalOcean App Platform** – Deployment

All book updates, meetings, events, and voting controls are managed through Google Sheets — no code changes required for monthly updates.

---

## ✨ Features

### 📖 Current Reads
- Supports **two monthly book picks**
- Automatically loads:
  - Cover image
  - Title & author
  - Summary (Open Library + fallback)
  - Tags
  - Meeting time & location
  - Discussion prompts
- Optional Goodreads link
- Fully editable via Google Sheets

---

### 📅 Meetings & Events Page
- Separate page for monthly picks
- Editable meeting details per book
- Dynamic event cards pulled from Sheets
- Supports:
  - Instagram event links
  - RSVP links
- Graceful fallback when no events exist

---

### 🗳 Voting System
- Voting toggle controlled in Sheets
- `voting_open = TRUE` enables vote button
- Google Form link editable in backend

---

### 📬 Newsletter
- Newsletter signups stored in Google Sheets
- Handled via Google Apps Script POST endpoint

---

## 🧠 Architecture
Google Sheets
↓
Google Apps Script API
↓
Static Website (fetch requests)
↓
Open Library API (book metadata)


---

## ⚙️ Backend Setup (Google Apps Script)

1. Create a Google Sheet with:
   - `current` tab (key/value structure)
   - `events` tab (table structure)
   - `newsletter` tab

2. Create Apps Script:
   - Paste backend `Code.gs`
   - Set your `SHEET_ID`
   - Deploy as Web App
   - Set access to **Anyone**

3. Paste the Web App URL into:

```js
var API_BASE = "YOUR_DEPLOYED_WEB_APP_URL";
```
📝 Monthly Update Workflow

To update books:

Replace:

book1_isbn

book2_isbn

Meeting details

Discussion prompts

Toggle voting:

voting_open = TRUE

Add vote_form_url

No redeploy needed — changes reflect automatically.

🎨 Tech Stack

HTML5

CSS3

Vanilla JavaScript

Google Apps Script

Google Sheets API

Open Library API

DigitalOcean App Platform
