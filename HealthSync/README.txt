HEALTHSYNC - Your Personal Health & Fitness Management System
Student prototype: HTML + CSS + JavaScript + localStorage. No backend, no frameworks.

OPEN ON ANDROID: keep index.html, style.css and script.js in one folder, then open index.html in Chrome (or press Preview in Spck).
EDIT IN SPCK: open the folder, tap a file, edit, save, refresh the preview.
FIRST SCREEN: the Login page opens first. Create Account is on it; "About HealthSync" opens the landing page.
FILES: index.html = structure | style.css = design | script.js = all functionality.
DATABASE: browser localStorage, key "healthsync_db" (accounts, profile, health, medical, workouts, progress, goals, challenges, points).
WORKOUT DONE: enter completed value, press "Workout Done" = +20 points once per workout per day. Bonuses (+10 daily, +50 five workouts, +50 7-day streak) are given once each. Progress, Reports, Challenges and Dashboard read the same data.
NOTICE: Data is stored locally in the browser, passwords are only lightly encoded, and nothing here is secure. Do not store real sensitive medical records. Not medical advice.
CHALLENGES: users add their own on the Challenges page (saved in localStorage as "custom"). Developers can also edit the CHAL list in script.js.
GOALS: when a goal reaches 100% press "Goal Done" = +30 points once. Completed goals show in Progress, Reports and Dashboard.
REPORT FILE: Reports page > Download CSV (opens in Excel/Sheets) or Download JSON. The file is saved to your phone Downloads folder.
IF THE REPORT DOES NOT DOWNLOAD: use the Share / Copy options in the save panel, or open the site in Chrome instead of the editor preview.
SHARE REPORT: in the save panel enter a mobile number with country code, then tap WhatsApp or SMS (sends a text summary). For Instagram, Google Drive and other apps use the share-sheet button.
