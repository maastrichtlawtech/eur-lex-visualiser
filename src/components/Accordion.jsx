import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Accordion({ title, children, defaultOpen = false, isOpen, onToggle }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (isOpen !== undefined) {
      setOpen(isOpen);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setOpen(!open);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        onClick={handleToggle}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t p-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

