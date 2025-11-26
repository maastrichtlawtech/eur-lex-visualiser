# EU Law Visualiser

A beautiful, interactive web application for reading and navigating European Union legal instruments. Built by [Konrad Kollnig](https://konradkollnig.com) at the [Law & Tech Lab, Maastricht University](https://www.maastrichtuniversity.nl/research/law-tech-lab).

## Features

- 📖 **Interactive Table of Contents**: Navigate through chapters, sections, and articles with an organized, collapsible structure
- 📝 **Recitals Viewer**: Quick access to all recitals with a grid-based navigation interface
- 📎 **Annexes Browser**: Easy browsing of supplementary materials and annexes
- 🔍 **Article Navigation**: Seamless navigation between articles, recitals, and annexes with Previous/Next controls
- 🎨 **Modern UI**: Clean, responsive design built with Tailwind CSS and Framer Motion animations
- 🔗 **URL State Management**: Shareable links with law selection preserved in the URL
- 📱 **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices

## Supported Legal Instruments

The visualiser currently supports the following EU legal instruments:

- **AI Act** (EU 2024/1689)
- **GDPR** (EU 2016/679) – Unconsolidated
- **DMA** (EU 2022/1925) – Unconsolidated
- **DSA** (EU 2022/2065)
- **Data Act** (EU 2023/2854)
- **Data Governance Act** (EU 2022/868)

## Tech Stack

- **React 19** – UI framework
- **Vite** – Build tool and dev server
- **Tailwind CSS** – Styling
- **Framer Motion** – Animations
- **Lucide React** – Icons

## Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd eu-law-visualiser
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Development

- `npm run dev` – Start the development server with hot module replacement
- `npm run build` – Build the project for production
- `npm run preview` – Preview the production build locally
- `npm run lint` – Run ESLint to check code quality

### Adding New Laws

To add a new legal instrument:

1. Place the law file (XHTML, XML, or HTML) in the `public/data/` directory
2. Add an entry to `src/constants/laws.js`:
```javascript
{ key: "law-key", label: "Law Name (EU YYYY/XXXX)", value: "data/law-file.xhtml" }
```

The parser automatically handles:
- Official Journal (OJ) format
- Consolidated format
- JSON format (if pre-processed)

## Project Structure

```
eu-law-visualiser/
├── public/
│   └── data/              # Legal instrument files (XHTML, XML, HTML)
├── src/
│   ├── components/        # React components
│   │   ├── Accordion.jsx   # Collapsible accordion component
│   │   ├── Button.jsx      # Reusable button component
│   │   ├── Landing.jsx     # Landing page component
│   │   └── TopBar.jsx      # Top navigation bar
│   ├── constants/
│   │   └── laws.js         # Supported laws configuration
│   ├── utils/
│   │   ├── fetch.js        # HTTP fetch utilities
│   │   ├── parsers.js      # XHTML/XML parsing logic
│   │   └── url.js          # URL state management
│   ├── App.jsx             # Main application component
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global styles
├── package.json
├── vite.config.js
└── README.md
```

## How It Works

1. **Parsing**: The application parses EU legal documents (typically in XHTML format from EUR-Lex) to extract:
   - Articles (with chapter/section hierarchy)
   - Recitals
   - Annexes

2. **Navigation**: Users can navigate through the document using:
   - The table of contents (organized by chapters and sections)
   - Recital grid (numbered buttons)
   - Annex list
   - Previous/Next buttons in the top bar

3. **State Management**: The selected law and current view are synchronized with the URL, allowing for:
   - Bookmarkable links
   - Browser back/forward navigation
   - Direct linking to specific laws

## Browser Support

The application works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid and Flexbox
- Fetch API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

## Credits

Built by **Konrad Kollnig** at the **Law & Tech Lab, Maastricht University**.

For questions or feedback, please contact [eu-law@trackercontrol.org](mailto:eu-law@trackercontrol.org).

## Acknowledgments

This project uses legal documents from EUR-Lex, the official database of EU law.
