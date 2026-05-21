# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Admin Authentication

Admin sign-in now uses GitHub authentication (username + Personal Access Token) and checks repository collaborator permissions through the GitHub API.

Requirements for admin access:
- A GitHub Personal Access Token entered in the admin login form
- The token owner must match the entered GitHub username
- The GitHub account must have `write`, `maintain`, or `admin` permission on this repository
- Use a token with minimum permissions and short expiration.
  - Classic PAT: grant only what is needed (typically `read:user` + `repo` for collaborator permission checks).
  - Fine-grained PAT: limit to this repository and include permissions needed to read collaborator permissions.
