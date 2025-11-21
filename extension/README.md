# EUR-Lex Visualiser Browser Extension

This browser extension allows you to capture HTML content from EUR-Lex pages and send it to your localhost visualiser application.

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project

## Usage

1. Navigate to any EUR-Lex page (e.g., https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679)
2. Click the extension icon in your browser toolbar
3. Click "Capture Current Page" to save the page HTML
4. Click "Send to Localhost" to open the visualiser with the captured content

## How It Works

- The extension captures the full HTML of the current EUR-Lex page
- Stores it in extension storage
- Sends it to `http://localhost:5173/eur-lex-visualiser` via URL parameters
- Your localhost app parses and visualises the law content

## Icons

The extension requires icon files (icon16.png, icon48.png, icon128.png). You can create simple placeholder icons or use any 16x16, 48x48, and 128x128 pixel images.

