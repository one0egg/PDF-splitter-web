# Drawing PDF Splitter

GitHub Pages package with user-editable detection patterns.

## What is included
- Drawing pattern input
- Revision pattern input
- Short help notes under both inputs
- Live pattern display showing exactly what is currently being matched
- Reset button to restore default patterns
- Pattern validation with friendly error message
- Safer ArrayBuffer handling
- GitHub Actions workflow that downloads browser libraries automatically

## Setup
1. Replace your repo files with these.
2. In **Settings → Pages**, choose **GitHub Actions**.
3. Push to `main`.
4. Wait for the workflow to finish.
5. Hard refresh the live page with `Ctrl + F5`.

## Default patterns
- Drawing: `HLY\d{2}-\d{3}-\d{4}`
- Revision: `[A-Z]\.\d+`

## Notes
- The PDF must already be searchable.
- No OCR is included.
