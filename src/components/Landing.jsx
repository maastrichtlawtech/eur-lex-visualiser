import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Trash, Clock } from "lucide-react";
import { LAWS } from "../constants/laws.js";

export function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [instructionsDismissed, setInstructionsDismissed] = useState(() => {
    try {
      return localStorage.getItem('eurlex_instructions_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [showExtensionInfo, setShowExtensionInfo] = useState(!instructionsDismissed);

  const dismissInstructions = (e) => {
    e.stopPropagation();
    setInstructionsDismissed(true);
    setShowExtensionInfo(false);
    localStorage.setItem('eurlex_instructions_dismissed', 'true');
  };

  const [customLaws, setCustomLaws] = useState([]);

  const [hiddenLaws, setHiddenLaws] = useState(() => {
    try {
      const stored = localStorage.getItem('eurlex_hidden_laws');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [lastOpened, setLastOpened] = useState(() => {
    try {
      const stored = localStorage.getItem('eurlex_last_opened');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Update document title
  useEffect(() => {
    document.title = "EU Law Visualiser";
  }, []);
  
  // Save last opened update when clicking a law
  const handleLawClick = (key, isCustom) => {
    // For custom laws, the timestamp is already in the law object from extension
    if (!isCustom) {
      const now = Date.now();
      const newLastOpened = { ...lastOpened, [key]: now };
      setLastOpened(newLastOpened);
      localStorage.setItem('eurlex_last_opened', JSON.stringify(newLastOpened));
    }
  };

  // Redirect to extension route if extension params are present
  useEffect(() => {
    const isExtension = searchParams.get('extension') === 'true';
    const key = searchParams.get('key');
    if (isExtension && key) {
      navigate(`/extension?extension=true&key=${key}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const [isExtensionReady, setIsExtensionReady] = useState(false);

  // Poll for custom laws
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'EURLEX_LAW_LIST') {
        setCustomLaws(event.data.payload.laws || []);
        setIsExtensionReady(true);
      }
      
      if (event.data.type === 'EURLEX_DELETE_SUCCESS') {
         // Refresh list
         window.postMessage({ type: 'EURLEX_GET_LIST' }, '*');
      }
      
      if (event.data.type === 'EURLEX_EXTENSION_READY') {
         setIsExtensionReady(true);
         window.postMessage({ type: 'EURLEX_GET_LIST' }, '*');
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Initial fetch
    window.postMessage({ type: 'EURLEX_GET_LIST' }, '*');
    
    // Poll for a bit to ensure we catch it if the extension script loads late
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 20) clearInterval(interval); // 10 seconds
      window.postMessage({ type: 'EURLEX_GET_LIST' }, '*');
    }, 500);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  const handleDelete = (e, key, isCustom) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this law?")) {
      if (isCustom) {
        window.postMessage({ type: 'EURLEX_DELETE_LAW', key }, '*');
      } else {
        const newHidden = [...hiddenLaws, key];
        setHiddenLaws(newHidden);
        localStorage.setItem('eurlex_hidden_laws', JSON.stringify(newHidden));
      }
    }
  };
  
  const formatDate = (ts) => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const allLaws = [
    ...customLaws.map(l => ({
      ...l,
      label: l.title,
      isCustom: true
    })),
    ...LAWS.map(l => ({
      ...l,
      isCustom: false,
      timestamp: lastOpened[l.key] || null
    }))
  ]
  .filter(l => !hiddenLaws.includes(l.key || l.value)) // Filter out hidden laws
  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Sort by last opened
  
  const hasCustomLaws = customLaws.length > 0;

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
          {!instructionsDismissed && !isExtensionReady && (
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
              Option 1 · Choose a popular EU law
            </h2>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {allLaws.map((law, idx) => (
              <motion.div
                key={law.key || law.value}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  handleLawClick(law.key || law.value, law.isCustom);
                  if (law.isCustom) {
                    navigate(`/extension?extension=true&key=${law.key}`);
                  } else {
                    navigate(`/law/${law.key}`);
                  }
                }}
                className="group relative flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md cursor-pointer"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleLawClick(law.key || law.value, law.isCustom);
                    if (law.isCustom) {
                      navigate(`/extension?extension=true&key=${law.key}`);
                    } else {
                      navigate(`/law/${law.key}`);
                    }
                  }
                }}
                role="button"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate pr-6">
                      {law.label}
                    </div>
                    
                    
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>Last opened: {formatDate(law.timestamp)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDelete(e, law.key || law.value, law.isCustom)}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                    title={law.isCustom ? "Delete from local storage" : "Hide this law"}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {!instructionsDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-10 w-full"
          >
            {!isExtensionReady && (
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                Option 2 · Visualise other EU laws
              </h2>
            )}
            <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${!isExtensionReady ? "mt-4" : ""}`}>
              <div className="flex w-full items-center justify-between px-6 py-4 text-left">
                <button
                  type="button"
                  onClick={() => setShowExtensionInfo((prev) => !prev)}
                  className="flex flex-1 items-center justify-between mr-4"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    Visualise other EU laws in 4 simple steps
                  </p>
                  <motion.span
                    animate={{ rotate: showExtensionInfo ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-xl text-gray-600 shadow-sm"
                  >
                    ❯
                  </motion.span>
                </button>
                
                <button
                  onClick={dismissInstructions}
                  className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  title="Dismiss these instructions permanently"
                >
                  Dismiss
                </button>
              </div>
              <AnimatePresence initial={false}>
                {showExtensionInfo && (
                  <motion.div
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                      open: { height: "auto", opacity: 1 },
                      collapsed: { height: 0, opacity: 0 },
                    }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                  <div className="space-y-4 border-t border-gray-100 px-6 pb-6 pt-4 text-xs">
                    <p className="text-gray-700">
                      Want to visualise a different EU law? Install our browser extension to open <strong>any recent EU law</strong> from EUR-Lex in this visualiser.
                    </p>

                    <div>
                      <p className="mb-3 font-medium text-gray-700">Install the extension:</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                        >
                          <span className="text-base">🌐</span>
                          <span>Chrome</span>
                        </a>
                        <a
                          href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                        >
                          <span className="text-base">🦁</span>
                          <span>Brave</span>
                        </a>
                        <a
                          href="https://chrome.google.com/webstore/detail/eur-lex-visualiser/akkfdjadggheloggnfonppfkbifanpbc"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 hover:shadow-sm"
                        >
                          <span className="text-base">🔷</span>
                          <span>Edge</span>
                        </a>
                        <a
                          href="https://addons.mozilla.org/en-US/firefox/addon/eur-lex-visualiser/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition hover:bg-orange-50 hover:shadow-sm"
                        >
                          <span className="text-base">🦊</span>
                          <span>Firefox</span>
                        </a>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white p-3">
                      <p className="font-medium text-gray-900">How it works:</p>
                      <ol className="mt-2 space-y-1.5 text-gray-700">
                        <li className="flex gap-2">
                          <span className="font-semibold text-gray-500">1.</span>
                          <span>Install the extension for your browser (see links above)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-gray-500">2.</span>
                          <span>
                            Visit a EU law page on EUR-Lex{" "}
                            (e.g.{" "}
                            <a
                              href="https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-blue-600 hover:underline"
                            >
                              https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
                            </a>
                            )
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-semibold text-gray-500">3.</span>
                          <span>Open the law in the <strong>English</strong> language using the language selector on EUR-Lex</span>
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

                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

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
