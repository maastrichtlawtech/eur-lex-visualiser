import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useLawViewerDerivedState } from "./useLawViewerDerivedState.js";

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useLawViewerDerivedState", () => {
  let container;
  let root;
  let latestValue;

  function Probe(props) {
    const { routeKey, ...rest } = props;
    latestValue = useLawViewerDerivedState({ ...rest, key: routeKey });
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestValue = null;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    container?.remove();
  });

  it("uses the served document language for legacy HTML fallback URLs and layout", async () => {
    await act(async () => {
      root.render(
        <Probe
          source={{
            loading: false,
            effectiveCelex: "32002L0058",
            currentLaw: null,
            slugReference: null,
          }}
          primaryDocument={{
            loading: false,
            data: {
              title: "Directive 2002/58/EC",
              source: "eurlex-html",
              langCode: "EN",
              articles: [{ article_number: "1", article_title: "Scope", article_html: "<p>Body</p>" }],
              recitals: [],
              annexes: [],
              crossReferences: {},
            },
          }}
          preferences={{
            formexLang: "DE",
            secondaryLang: "FR",
          }}
          selection={{ selected: { kind: "article", id: "1" } }}
          sourceUrl={null}
          searchParams={new URLSearchParams()}
          slug="directive-2002-58"
          routeKey={null}
          activeLoadError={null}
          t={(key) => key}
        />
      );
      await flushEffects();
    });

    expect(latestValue.documentLang).toBe("EN");
    expect(latestValue.isLegacyHtmlFallback).toBe(true);
    expect(latestValue.isSideBySide).toBe(false);
    expect(latestValue.eurlexUrl).toBe(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058"
    );
  });
});
