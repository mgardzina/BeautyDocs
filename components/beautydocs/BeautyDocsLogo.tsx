import { BeautyDocsWordmark } from "./BeautyDocsWordmark";

/** The same green symbol and wordmark used by the public homepage. */
export function BeautyDocsLogo({ className = "text-[#173d35]" }: { readonly className?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden="true" className="shrink-0 text-[30px] leading-none text-[#66845b]">✳</span>
      <BeautyDocsWordmark className={className} />
    </span>
  );
}
