"use client";

import { useEffect, useState } from "react";
import { fetchCarImageUrl } from "@/lib/images";

interface CarImageProps {
  modelName: string;
  brand?: string;
  className?: string;
  dim?: boolean;
}

export default function CarImage({
  modelName,
  brand = "BMW",
  className = "",
  dim = false,
}: CarImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchCarImageUrl(modelName, brand).then((u) => {
      setUrl(u);
      setLoading(false);
    });
  }, [modelName, brand]);

  if (loading) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  if (!url || error) {
    return (
      <div
        className={`flex h-full items-center justify-center bg-white/[0.02] ${className}`}
      >
        <span className="text-xs font-medium tracking-wide text-gray-600">
          {brand} {modelName}
        </span>
      </div>
    );
  }

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      src={url}
      alt={`${brand} ${modelName}`}
      draggable={false}
      className={`pointer-events-none h-full w-full select-none object-cover ${dim ? "opacity-60" : ""} ${className}`}
      onError={() => setError(true)}
    />
  );
}
