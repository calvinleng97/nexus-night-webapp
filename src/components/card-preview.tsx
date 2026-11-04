"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

/** Card art aspect: 744 × 1039. */
const RATIO = 1039 / 744;
/** Wide enough that rules text reads without zooming. */
const PORTRAIT_W = 340;
const LANDSCAPE_W = 460;
const GAP = 12;

type Pos = { left: number; top: number; width: number; height: number };

/** Beside the name, on whichever side has room, kept inside the viewport. */
function place(anchor: DOMRect, landscape: boolean): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(landscape ? LANDSCAPE_W : PORTRAIT_W, vw - 2 * GAP);
  const height = landscape ? width / RATIO : width * RATIO;
  const right = anchor.right + GAP;
  const left = right + width <= vw - GAP ? right : Math.max(GAP, anchor.left - GAP - width);
  const top = Math.min(Math.max(GAP, anchor.top + anchor.height / 2 - height / 2), vh - GAP - height);
  return { left, top: Math.max(GAP, top), width, height };
}

/**
 * A card name that shows the card. With a mouse, hovering (or focusing) it
 * floats the full-size card beside the name; on a touchscreen, where there is
 * no hover, a tap opens the card full-screen instead, with the wiki one tap
 * further. Without JavaScript it is still the plain wiki link.
 */
export function CardPreview({
  href,
  name,
  src,
  landscape,
  className,
  children,
}: {
  href: string;
  name: string;
  /** Print-size card image; next/image serves it resized. */
  src: string;
  landscape: boolean;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const lastPointer = useRef<string>("mouse");
  const [hover, setHover] = useState<Pos | null>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    if (ref.current) setHover(place(ref.current.getBoundingClientRect(), landscape));
  };
  const hide = () => setHover(null);

  // Hide on scroll: a fixed preview would otherwise drift off its name.
  useEffect(() => {
    if (!hover) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [hover]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          lastPointer.current = e.pointerType;
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={hide}
        onFocus={() => lastPointer.current === "mouse" && show()}
        onBlur={hide}
        onClick={(e) => {
          if (lastPointer.current === "mouse") return; // follow the link
          e.preventDefault();
          hide();
          setOpen(true);
        }}
      >
        {children}
      </a>

      {hover
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed z-50 overflow-hidden rounded-[4.5%] bg-raised shadow-2xl shadow-black/70 ring-1 ring-white/10"
              style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height }}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes={`${hover.width}px`}
                className="object-cover"
              />
            </div>,
            document.body,
          )
        : null}

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={name}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <Image
                src={src}
                alt={name}
                width={landscape ? 1039 : 744}
                height={landscape ? 744 : 1039}
                sizes="92vw"
                className={`h-auto rounded-[4.5%] bg-raised shadow-2xl ${
                  landscape ? "w-full max-w-xl" : "max-h-[75dvh] w-auto max-w-full"
                }`}
              />
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-xl border border-hair bg-raised px-4 text-sm font-medium text-fg"
                >
                  Wiki ↗
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center rounded-xl border border-accent bg-accent px-5 text-sm font-semibold text-ink"
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
