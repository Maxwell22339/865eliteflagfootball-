# 865 Elite Flag Football - Current Repository Notes

## Overview

This repository is the current source for the 865 Elite Flag Football site. It is a static front end backed by browser storage and optional Supabase persistence for shared data.

## Current structure

- `index.html` contains the page markup
- `styles.css` contains the site styling
- `script.js` contains the client-side behavior

## Current branding state

- The site shell uses text-based branding in the header and footer
- The hero area uses CSS-only background styling
- Static bundled logo/background image references were removed from the repository source

## Current content model

- League content, settings, and admin-managed updates are handled in the front end
- Shared production data can be synchronized through Supabase
- Dynamic gallery items, uploaded documents, and team logos are still runtime-managed where those features are used

## Local preview

Open `index.html` in a browser to preview the site locally.
