import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

export default function BackButton({
  onClick,
  className = "",
  label = "Powrót",
}: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 bg-brand/10 hover:bg-brand border border-brand text-brand hover:text-white px-6 py-2.5 rounded-xl transition-all font-bold uppercase tracking-widest text-xs shadow-lg shadow-brand/10 ${className}`}
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
      {label}
    </button>
  );
}
