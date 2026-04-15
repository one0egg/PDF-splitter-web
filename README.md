# Drawing PDF Splitter

Fresh rebuild package for GitHub Pages.

## What is included
- Corrected worker path handling
- Cache-busting query strings on the app and vendor script references
- Safer ArrayBuffer handling to avoid `Cannot perform Construct on a detached ArrayBuffer`
- Detection based on viewport coordinates so the red preview rectangle and extracted text use the same coordinate space
- GitHub Actions workflow that downloads browser libraries automatically

## Files
- `index.html`
- `style.css`
- `app.js`
- `.github/workflows/pages.yml`

## Setup
1. Create a fresh GitHub repository or replace the existing repo files with these.
2. In **Settings → Pages**, choose **GitHub Actions**.
3. Push to `main`.
4. Wait for the workflow to finish.
5. Hard refresh the live page with `Ctrl + F5`.

## Notes
- The PDF must already be searchable.
- No OCR is included.
- If no drawing number is found, the export filename falls back to `UNKNOWN_DRAWING_PAGE_001.pdf`.
