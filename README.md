# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Admin Authentication

Admin sign-in now uses GitHub authentication (username + personal access token) and checks repository collaborator permissions through the GitHub API.

Requirements for admin access:
- A GitHub personal access token entered in the admin login form
- The token owner must match the entered GitHub username
- The GitHub account must have `write`, `maintain`, or `admin` permission on this repository
- Use a token with minimum permissions and short expiration.
  - Fine-grained PAT is preferred: limit access to this repository only, with at least repository **Metadata (read)** and **Administration (read)** permissions.
  - Classic PATs may require broader scopes; if used, create a dedicated short-lived token and rotate it often.

Security note:
- The token is stored in `sessionStorage` only for the active browser session and is used solely for GitHub verification calls.
- Treat this site as a trusted admin environment, and enforce a strict Content Security Policy when deploying to reduce XSS risk.
