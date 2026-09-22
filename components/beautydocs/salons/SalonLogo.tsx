"use client";
import { useState } from "react";
export function SalonLogo({ url, name }: { url: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="bd-salon-logo" aria-hidden="true">{url && failedUrl !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setFailedUrl(url)} />
  ) : name.slice(0, 1)}</span>;
}
