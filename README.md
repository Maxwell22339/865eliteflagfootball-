# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Shared Data Setup (Firebase Realtime Database)

To make admin updates visible to everyone (instead of browser-only storage), configure Firebase:

1. Create a Firebase project and enable:
   - Realtime Database
   - Authentication (Email/Password)
2. In `index.html`, fill in:
   - `window.__865EliteFirebaseConfig` with your Firebase web app config values
   - `window.__865EliteFirebaseAdminEmails` with admin username-to-email mappings
3. Create Firebase Auth users for each admin email in that mapping.
4. Use Realtime Database rules that allow public reads and authenticated admin writes only.

When configured, admin saves sync to Firebase and are loaded on site startup for all visitors. If Firebase is not configured, the site falls back to local browser storage.
