# Drawing PDF Splitter

GitHub Pages-ready browser tool for splitting a searchable combined drawing PDF into one-page PDFs and generating a CSV register.

## Good news

You do **not** need to manually download vendor JavaScript files.

This repo includes a GitHub Actions workflow that downloads the required browser libraries during deployment and publishes the finished site to GitHub Pages.

## What users do

- Open the GitHub Pages URL
- Choose a PDF from local drive
- Preview the scan rectangle
- Split the PDF
- Download the ZIP output

The selected PDF stays in the browser. The app does not upload the PDF anywhere by itself.

## What you need to do

1. Create a new GitHub repository.
2. Upload all files from this package.
3. Commit to the `main` branch.
4. In GitHub, go to **Settings → Pages**.
5. Set **Build and deployment** to **GitHub Actions**.
6. Push a commit, or run the workflow manually from the **Actions** tab.
7. After the workflow finishes, open the GitHub Pages URL.

## Files in this package

- `index.html`
- `style.css`
- `app.js`
- `.github/workflows/pages.yml`

## Notes

- This app expects the PDF text to already be searchable.
- No OCR is included.
- If a page has no matching drawing number, it is exported as `UNKNOWN_DRAWING_PAGE_001.pdf` and so on.
