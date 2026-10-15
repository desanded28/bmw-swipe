"use client";

import { Map as MapIcon, Navigation } from "lucide-react";
import { useId, useState } from "react";
import { useT } from "@/i18n/provider";
import { buttonClass } from "./ui";

/** OpenStreetMap's embeddable map around a point (about 1 km wide). */
export function mapEmbedUrl(lat: number, lng: number): string {
  const bbox = [lng - 0.006, lat - 0.003, lng + 0.006, lat + 0.003].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Directions on openstreetmap.org: to the point when known, else a search for the address. */
export function directionsUrl(o: { lat: number | null; lng: number | null; address: string }): string {
  if (o.lat != null && o.lng != null) return `https://www.openstreetmap.org/directions?route=%3B${o.lat.toFixed(5)}%2C${o.lng.toFixed(5)}`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(o.address)}`;
}

/**
 * Click-to-load map. Nothing is requested from openstreetmap.org until the visitor asks for it:
 * the iframe is mounted only after the button is pressed (no third-party request, cookie or
 * referrer on page load), and then without a referrer. The directions link leaves the site.
 */
export function MapEmbed({ lat, lng, office, address }: { lat: number | null; lng: number | null; office: string; address: string }) {
  const t = useT("marketplace");
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const hasPoint = lat != null && lng != null;

  return (
    <div>
      {hasPoint && open ? (
        <div id={regionId}>
          <iframe
            title={t("map.title", { office })}
            className="h-48 w-full border-0"
            src={mapEmbedUrl(lat, lng)}
            referrerPolicy="no-referrer"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        {hasPoint ? (
          <button
            type="button"
            // The label is long (it names the third party): let it wrap on narrow screens.
            className={buttonClass("secondary", "sm", "text-left whitespace-normal!")}
            aria-expanded={open}
            aria-controls={regionId}
            onClick={() => setOpen((v) => !v)}
          >
            <MapIcon size={13} aria-hidden /> {open ? t("map.hide") : t("map.show")}
          </button>
        ) : null}
        <a className={buttonClass("ghost", "sm")} href={directionsUrl({ lat, lng, address })} target="_blank" rel="noreferrer noopener">
          <Navigation size={13} aria-hidden /> {t("map.directions")}
          <span className="sr-only"> ({t("map.directionsHint")})</span>
        </a>
      </div>
      {hasPoint && !open ? <p className="px-5 pt-1.5 text-xs text-slate-500">{t("map.privacy")}</p> : null}
    </div>
  );
}
