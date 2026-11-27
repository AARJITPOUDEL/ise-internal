# International Simple English

A small, calm workspace for two people, **Aarjit** and **Mo Riddiford**:

- **Tasks**: assignee, date added, urgency, estimated finish date, progress, notes and comments
- **Meet notes**: one shared note per Google Meet call, saved as you type
- **Work logs**: a daily log with optional hours, plus replies
- **Links**: saved Google Docs, Sheets, Drive files and other links, with an optional notification
- **Notifications**: a banner at the top of the app and a bell with every update from the other person

The website is one file (`index.html`) hosted free on **GitHub Pages**. All data is saved in a **Google Sheet**
through a small **Google Apps Script** (`Code.gs`) that acts as the server.

```
Browser (GitHub Pages)  ──HTTPS──▶  Apps Script web app  ──▶  Google Sheet
index.html                          Code.gs                   tabs: tasks, notes, logs, links, feed
```

Passwords are kept in the Apps Script, not in this repository, so the repository can be public.

---

## Setup (about 15 minutes)

### 1. Create the Google Sheet
1. Go to <https://sheets.new> while signed in to the Google account that will own the data.
2. Name it **International Simple English**.

### 2. Add the Apps Script
1. In the sheet, open **Extensions → Apps Script**.
2. Delete the sample code in `Code.gs`, paste in everything from [`Code.gs`](Code.gs), and click **Save** (💾).

### 3. Set the passwords
1. In the Apps Script editor, click **Project Settings** (⚙️ on the left).
2. Scroll to **Script properties → Add script property** and add two:

   | Property      | Value                  |
   |---------------|------------------------|
   | `PASS_AARJIT` | Aarjit's password      |
   | `PASS_MO`     | Mo's password          |

3. Click **Save script properties**.

> The site will be on the public internet, so use something stronger than `4001` / `4002`.
> The script locks a name for 15 minutes after 8 wrong tries.

### 4. Run setup once
1. Go back to the **Editor** (`< >` icon), choose **`setup`** in the function menu at the top, and click **Run**.
2. Google asks for permission. Choose your account, then **Advanced → Go to (project name) (unsafe) → Allow**.
   The warning appears because this is your own unpublished script. It only gets access to this one spreadsheet.
3. The log should say **"Setup complete."** Five tabs now exist in the sheet: `tasks`, `notes`, `logs`, `links`, `feed`.

### 5. Deploy it as a web app
1. Click **Deploy → New deployment**, then the ⚙️ next to "Select type" → **Web app**.
2. Set:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*. This is needed so the website can reach the script. Nobody can read or
     change data without signing in with a password.
3. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
4. Open that URL in your browser. You should see `{"ok":true,...,"status":"running"}`.
5. In `index.html`, find this line near the top of the `<script>` and paste your URL in:

   ```js
   const API_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';
   ```

### 6. Put it on GitHub Pages
1. Create a repository on GitHub, for example `international-simple-english`. Public is fine.
2. Upload `index.html`, `Code.gs` and `README.md`. You can drag them in with
   **Add file → Upload files**, or `git push`.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**,
   branch **`main`**, folder **`/ (root)`**, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/international-simple-english/`.
5. Send that link to Mo. Each of you picks your name and signs in.

---

## Day-to-day notes

- **Sync:** changes save straight away. The other person sees them within about 12 seconds, or right away when
  they switch back to the tab.
- **The sheet is the database.** You can read it any time. Avoid editing it by hand while the app is in use,
  and never rename the tabs or move the `id` column. Times (`at`, `createdAt`, `updatedAt`) are stored as
  JavaScript timestamps in milliseconds.
- **Backups:** in the sheet, use **File → Version history**, or **File → Make a copy**.
- **Changing a password:** edit the Script property. People who are already signed in stay signed in for up to
  30 days. To sign everyone out, delete all `TOKEN_...` properties.
- **Limits:** one cell holds about 50,000 characters, so a single meeting note can be roughly 20 pages long.

## Updating the code later

- **Website:** edit `index.html` and push. GitHub Pages updates in about a minute.
- **Apps Script:** paste the new code, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
  The URL stays the same. Choosing *New deployment* instead would give you a new URL.

## Troubleshooting

| You see | Fix |
|---|---|
| "This copy is not connected to Google Sheets yet" | `API_URL` in `index.html` is still the placeholder (step 5). |
| "Couldn't reach Google" on sign in | Check the URL ends in `/exec`, and that access is set to **Anyone** (not "Anyone with a Google account"). |
| "Passwords are not set in the Apps Script yet" | Add `PASS_AARJIT` and `PASS_MO` (step 3). The names must match exactly. |
| Changes to `Code.gs` have no effect | Deploy a **New version** of the existing deployment (see above). |
| "Too many wrong tries" | Wait 15 minutes. |
