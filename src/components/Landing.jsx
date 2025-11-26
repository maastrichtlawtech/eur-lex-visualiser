import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Github } from "lucide-react";
import { LAWS } from "../constants/laws.js";

export function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Update document title
  useEffect(() => {
    document.title = "EU Law Visualiser";
  }, []);

  // Redirect to extension route if extension params are present
  useEffect(() => {
    const isExtension = searchParams.get('extension') === 'true';
    const key = searchParams.get('key');
    if (isExtension && key) {
      navigate(`/extension?extension=true&key=${key}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium tracking-tight text-gray-700 ring-1 ring-gray-200">
            EU Law Visualiser
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Read EU law beautifully,
            <span className="block text-gray-600">one at a time.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
            Choose the instrument you are working with. You will then see an interactive view with
            chapters, articles, recitals, and annexes side by side.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 w-full"
        >
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
            Step 1 · Select a law
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LAWS.map((law, idx) => (
              <motion.button
                key={law.value}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate(`/law/${law.key}`)}
                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {law.label}
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      Click to open an interactive table of contents, recitals and annexes.
                    </p>
                  </div>
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-[11px] text-gray-700">
                    {idx + 1}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    Articles viewer
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    Recitals
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    Annexes
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 w-full"
        >
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-sm font-semibold text-gray-900">
              Visualize Any EU Law
            </h2>
            <p className="mt-2 text-xs text-gray-700">
              Want to visualize a different EU law? Install our browser extension to open <strong>any EU law</strong> from EUR-Lex in this visualiser.
            </p>
            
            <div className="mt-4">
              <p className="mb-3 text-xs font-medium text-gray-700">Install the extension:</p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                >
                  <span className="text-base">🌐</span>
                  <span>Chrome</span>
                </a>
                <a
                  href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                >
                  <span className="text-base">🦁</span>
                  <span>Brave</span>
                </a>
                <a
                  href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                >
                  <span className="text-base">🔷</span>
                  <span>Edge</span>
                </a>
                <a
                  href="https://addons.mozilla.org/en-US/firefox/addon/eur-lex-visualiser/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-orange-50 hover:shadow-sm"
                >
                  <span className="text-base">🦊</span>
                  <span>Firefox</span>
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-white p-3">
              <p className="text-xs font-medium text-gray-900">How it works:</p>
              <ol className="mt-2 space-y-1.5 text-xs text-gray-700">
                <li className="flex gap-2">
                  <span className="font-semibold text-gray-500">1.</span>
                  <span>Install the extension for your browser (see links above)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-gray-500">2.</span>
                  <span>
                    Visit any EU law page on EUR-Lex{" "}
                    (e.g.{" "}
                    <a
                      href="https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
                    </a>
                    )
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-gray-500">3.</span>
                  <span>Open the law in your preferred language using the language selector on EUR-Lex</span>
                </li>
                <li className="mt-2">
                  <img
                    src={`${import.meta.env.BASE_URL}/language-selector.png`}
                    alt="EUR-Lex language selector showing available languages"
                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                  />
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-gray-500">4.</span>
                  <span>The extension automatically opens the law in this visualiser</span>
                </li>
              </ol>
            </div>

            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
              <p className="text-xs font-medium text-red-900">⚠️ Note:</p>
              <p className="mt-1 text-xs text-red-800">
                Languages other than English currently do not function properly. Please use the English version of EU laws for best results.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">💡 Pro tip:</p>
              <p className="mt-1 text-xs text-amber-800">
                Create a bookmark to the visualised law page to easily access it again later!
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-col items-center gap-2 text-xs text-gray-500"
        >
          <p>
            Built by{" "}
            <a
              href="https://kollnig.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 underline"
            >
              Konrad Kollnig
            </a>{" "}
            at the{" "}
            <a
              href="https://www.maastrichtuniversity.nl/law-tech-lab"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 underline"
            >
              Law &amp; Tech Lab
            </a>
            , Maastricht University.
          </p>
          <a
            href="https://github.com/maastrichtlawtech/eur-lex-visualiser"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-gray-600 transition hover:text-gray-900"
          >
            <Github className="h-4 w-4" />
            <span>Source code and support on GitHub</span>
          </a>
        </motion.div>
      </div>
    </div>
  );
}

