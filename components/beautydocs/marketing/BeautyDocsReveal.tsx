"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface BeautyDocsRevealProps {
  readonly children: ReactNode;
  /** Delay before the reveal animation starts, in ms. */
  readonly delay?: number;
  readonly className?: string;
}

/** Fades + lifts its children into view once, when scrolled near the viewport. */
export function BeautyDocsReveal({
  children,
  delay = 0,
  className = "",
}: BeautyDocsRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`bd-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--bd-reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
