interface BeautyDocsWordmarkProps {
  readonly className?: string;
}

/**
 * The shared BeautyDocs wordmark. The brand is intentionally rendered as one
 * uninterrupted word so every product surface uses the same logo treatment.
 */
export function BeautyDocsWordmark({
  className = "text-[#173d35]",
}: BeautyDocsWordmarkProps) {
  return (
    <span className={`inline-block font-sans text-xl font-black tracking-[-0.045em] ${className}`}>
      BeautyDocs
    </span>
  );
}
