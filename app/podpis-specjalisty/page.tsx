"use client";

import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";

export default function SpecialistSignaturePage() {
  const [signature, setSignature] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-ui-appBg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gradient-emerald p-8 rounded-2xl shadow-xl border border-emerald/20">
        <h1 className="text-3xl font-serif text-white mb-6 text-center">
          Generator Podpisu Specjalisty
        </h1>
        <p className="text-ui-textSecondary mb-8 text-center">
          Proszę złożyć podpis poniżej. Po zatwierdzeniu pojawi się kod, który
          należy skopiować i przesłać programiście.
        </p>

        <div className="mb-8 border border-emerald/30 rounded-xl overflow-hidden bg-black/20">
          <SignaturePad
            label="Podpis Specjalisty (Joanna Wielgos)"
            value={signature}
            onChange={setSignature}
            date={new Date().toLocaleDateString("pl-PL")}
          />
        </div>

        {signature && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-medium text-white">Twój kod podpisu:</h3>
            <textarea
              readOnly
              value={signature}
              className="w-full h-32 p-4 bg-black/40 border border-emerald/30 rounded-lg font-mono text-xs text-ui-textSecondary resize-none focus:outline-none focus:border-brand"
            />
            <button
              onClick={handleCopy}
              className="w-full py-4 bg-brand text-black rounded-xl font-bold uppercase tracking-wider hover:bg-brand/90 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {copied ? "Skopiowano do schowka!" : "Kopiuj kod podpisu"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
