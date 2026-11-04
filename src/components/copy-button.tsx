"use client";

import { btn } from "./ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  label: ReactNode;
  copiedLabel?: ReactNode;
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
      className={`${btn(copied ? "default" : "default", "md")} ${copied ? "!border-win/40 !bg-win/10 !text-win" : ""} ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
