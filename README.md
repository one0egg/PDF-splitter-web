# Drawing PDF Splitter

Fresh GitHub Pages package for splitting a searchable combined drawing PDF into one-page PDFs and generating a CSV register.

## What this version includes
- Corrected `app.js` worker path handling
- GitHub Actions workflow that downloads the required browser libraries during deployment
- No manual vendor download needed on your laptop

## Repo files
- `index.html`
- `style.css`
- `app.js`
- `.github/workflows/pages.yml`

## Setup
1. Create a new GitHub repository.
2. Upload all files from this package.
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to `main` or run the workflow manually from **Actions**.
6. After deploy finishes, hard refresh the site with `Ctrl + F5`.

## Notes
- The app expects the PDF text to already be searchable.
- No OCR is included.
- If no drawing number is detected, output files are named like `UNKNOWN_DRAWING_PAGE_001.pdf`.
