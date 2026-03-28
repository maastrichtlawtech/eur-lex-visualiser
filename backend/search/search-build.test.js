const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTitleFromEurlexHtml } = require("./search-build");

test("extractTitleFromEurlexHtml prefers WT.z_docTitle metadata", () => {
  const html = `
    <html>
      <head>
        <meta name="WT.z_docTitle" content="Directive (EU) 2015/2366 on payment services in the internal market" />
      </head>
      <body>
        <p id="title">Ignored fallback title</p>
      </body>
    </html>
  `;

  assert.equal(
    extractTitleFromEurlexHtml(html),
    "Directive (EU) 2015/2366 on payment services in the internal market"
  );
});

test("extractTitleFromEurlexHtml falls back to the title element in the page body", () => {
  const html = `
    <html>
      <body>
        <p id="title">
          Directive (EU) 2015/2366 of the European Parliament and of the Council
          on payment services in the internal market
        </p>
      </body>
    </html>
  `;

  assert.equal(
    extractTitleFromEurlexHtml(html),
    "Directive (EU) 2015/2366 of the European Parliament and of the Council on payment services in the internal market"
  );
});
