"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copies `text` to the clipboard and confirms with a brief label swap.
 *
 * navigator.clipboard is only available in secure contexts, so a plain-text
 * fallback keeps the button working over plain http on a LAN.
 */
export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  title,
  className = "",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
        copied
          ? "border-win/40 bg-win/10 text-win"
          : "border-hair bg-raised text-fg hover:border-accent/40"
      } ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
