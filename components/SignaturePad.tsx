"use client";

import { useRef, useEffect, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignaturePadProps {
  label: string;
  value: string;
  onChange: (signature: string) => void;
  required?: boolean;
  date?: string;
  hasBorder?: boolean;
}

export default function SignaturePad({
  label,
  value,
  onChange,
  required,
  date,
  hasBorder = true,
}: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resize the canvas to match its container dimensions
  const resizeCanvas = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = sigCanvas.current?.getCanvas();
    if (!wrapper || !canvas) return;

    const { width, height } = wrapper.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Save current signature data
    const data = sigCanvas.current?.toDataURL("image/png");

    canvas.width = width;
    canvas.height = height;

    // Restore signature data after resize
    if (data && data !== "data:,") {
      sigCanvas.current?.fromDataURL(data, { width, height });
    }
  }, []);

  // Initial load: restore saved value
  useEffect(() => {
    if (value && sigCanvas.current) {
      // Small delay to ensure canvas is mounted and sized
      const t = setTimeout(() => {
        sigCanvas.current?.fromDataURL(value);
      }, 50);
      return () => clearTimeout(t);
    }
  }, []);

  // Observe wrapper size changes and resize accordingly
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });
    observer.observe(wrapper);
    // Initial resize
    resizeCanvas();

    return () => observer.disconnect();
  }, [resizeCanvas]);

  const handleClear = () => {
    sigCanvas.current?.clear();
    onChange("");
  };

  const handleEnd = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      onChange(dataUrl);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm text-[#6b6560] font-medium uppercase tracking-wide">
        {label} {required && "*"}
      </label>

      <div className="relative group">
        <div
          ref={wrapperRef}
          className={`rounded-xl overflow-hidden relative w-full h-[160px] bg-[#F5F3F0] ${
            hasBorder ? "border border-[#d4cec4]" : ""
          }`}
        >
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              style: {
                width: "100%",
                height: "100%",
                display: "block",
                touchAction: "none",
              },
            }}
            backgroundColor="rgba(0,0,0,0)"
            penColor="#000000"
            minWidth={1.0}
            maxWidth={2.5}
            onEnd={handleEnd}
          />

          {/* Clear button */}
          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs bg-white/80 px-2 py-1 rounded shadow-sm text-[#8b7355] hover:text-[#6b5540] transition-colors"
            >
              Wyczyść
            </button>
          </div>

          {/* Placeholder text if empty */}
          {!value && (
            <div className="absolute bottom-4 left-4 pointer-events-none select-none z-0">
              <span className="text-[#d4cec4] text-xs uppercase tracking-widest border-t border-[#d4cec4] pt-1">
                Podpisz tutaj
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Date label BELOW signature */}
      {date && (
        <p className="text-xs text-[#6b6560] font-serif italic text-right mt-1">
          {date}
        </p>
      )}
    </div>
  );
}
