"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export interface ProductGalleryImage {
  readonly alt: string;
  readonly fit: "contain" | "cover";
  readonly label: string;
  readonly note: string | null;
  readonly path: string;
  readonly scale: number;
}

export function ProductMediaGallery({
  images,
  name,
}: {
  readonly images: readonly ProductGalleryImage[];
  readonly name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedPaths, setFailedPaths] = useState<readonly string[]>([]);
  const availableImages = images.filter((image) => !failedPaths.includes(image.path));
  const safeIndex = Math.min(activeIndex, Math.max(availableImages.length - 1, 0));
  const activeImage = availableImages[safeIndex] ?? null;

  function selectRelative(offset: number) {
    if (availableImages.length < 2) return;
    setActiveIndex(
      (safeIndex + offset + availableImages.length) % availableImages.length,
    );
  }

  return (
    <div className="min-w-0">
      <div
        className="relative isolate aspect-square overflow-hidden rounded-[32px] bg-[#eef1e7]"
        data-testid="product-gallery-main"
      >
        <div
          aria-hidden="true"
          className="absolute -left-28 -top-24 size-80 rounded-full bg-[#d8bfa7]/60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -right-24 size-96 rounded-full bg-[#e0ead1]/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-[12%] bottom-[8%] h-[12%] rounded-[50%] bg-black/10 blur-3xl"
        />

        {activeImage ? (
          <Image
            alt={activeImage.alt}
            className={`${
              activeImage.fit === "cover" ? "object-cover" : "object-contain"
            } transition-transform duration-500 ease-out`}
            fill
            onError={() => {
              setFailedPaths((current) => [...current, activeImage.path]);
              setActiveIndex(0);
            }}
            priority
            sizes="(max-width: 1024px) 100vw, 52vw"
            src={activeImage.path}
            style={{ transform: `scale(${activeImage.scale})` }}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <ImageIcon aria-hidden="true" className="mx-auto size-9 text-stone-400" />
              <p className="mt-3 text-sm font-bold text-stone-500">
                Zdjęcie produktu jest w przygotowaniu
              </p>
            </div>
          </div>
        )}

        {availableImages.length > 1 ? (
          <>
            <button
              aria-label="Poprzednie zdjęcie"
              className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#252c26] shadow-sm backdrop-blur transition hover:bg-white sm:left-6"
              onClick={() => selectRelative(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              aria-label="Następne zdjęcie"
              className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#252c26] shadow-sm backdrop-blur transition hover:bg-white sm:right-6"
              onClick={() => selectRelative(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
            <span className="absolute right-5 top-5 rounded-full bg-[#173d35]/80 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
              {safeIndex + 1} / {availableImages.length}
            </span>
          </>
        ) : null}
      </div>

      {availableImages.length > 1 ? (
        <div
          aria-label={`Galeria produktu ${name}`}
          className="mt-4 flex w-full min-w-0 gap-3 overflow-x-auto pb-1"
          role="group"
        >
          {availableImages.map((image, index) => (
            <button
              aria-label={`Pokaż zdjęcie: ${image.label}`}
              aria-pressed={safeIndex === index}
              className={`relative size-20 shrink-0 overflow-hidden rounded-2xl bg-[#eef1e7] transition sm:size-24 ${
                safeIndex === index
                  ? "ring-2 ring-[#477066] ring-offset-2"
                  : "opacity-65 hover:opacity-100"
              }`}
              key={`${image.path}:${image.label}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <Image
                alt=""
                className={
                  image.fit === "cover" ? "object-cover" : "object-contain p-2"
                }
                fill
                sizes="96px"
                src={image.path}
                style={{ transform: `scale(${Math.min(image.scale, 1.2)})` }}
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      {activeImage?.note ? (
        <p aria-live="polite" className="mt-3 text-xs leading-5 text-stone-500">
          {activeImage.note}
        </p>
      ) : null}
    </div>
  );
}
