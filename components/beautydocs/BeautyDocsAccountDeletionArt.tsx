"use client";

/**
 * Small hand-drawn-style illustration for the account-deletion confirmation:
 * a person setting down a box, looking back once before leaving. Built from
 * simple shapes so it reads clearly at card size, in the app's own palette
 * rather than a generic stock icon.
 */
export function BeautyDocsAccountDeletionArt({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 220 180"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ground shadow */}
      <ellipse cx="110" cy="163" fill="#e4ecd8" rx="72" ry="10" />

      {/* box being left behind */}
      <g>
        <rect x="122" y="118" width="54" height="40" rx="4" fill="#eef3e7" stroke="#245c4d" strokeWidth="2.5" />
        <path d="M122 132h54" stroke="#245c4d" strokeWidth="2.5" />
        <path d="M141 118l8 14 8-14" stroke="#245c4d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* seated figure, hands to face */}
      <g>
        <path
          d="M55 158c-3-20 2-34 14-42-5-9-4-19 4-25 9-7 21-4 26 5 6-8 17-9 24-2 8 7 8 19 0 27 9 7 12 20 9 37"
          fill="#f7f8f4"
          stroke="#173d35"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* head */}
        <circle cx="86" cy="76" r="17" fill="#eef3e7" stroke="#173d35" strokeWidth="2.5" />
        {/* hair */}
        <path
          d="M70 72c-2-10 5-19 16-19s18 8 17 18"
          fill="none"
          stroke="#245c4d"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* arms up to face */}
        <path
          d="M63 100c2-10 9-16 15-18M109 100c-2-10-9-16-15-18"
          stroke="#173d35"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* simple closed-eye, wistful expression */}
        <path d="M80 78c2-2 5-2 7 0M92 78c2-2 5-2 7 0" stroke="#173d35" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* small sparkle accents */}
      <path d="M172 60l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#b8cbaa" />
      <path d="M40 96l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z" fill="#b8cbaa" />
    </svg>
  );
}
