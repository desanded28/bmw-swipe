"use client";

import { jakarta } from "./fonts";
import "./globals.css";

/**
 * Replaces the root layout when it fails, so it cannot rely on the i18n provider (that may be
 * what broke). The text is bilingual: Italian first, then English.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it" className={jakarta.variable}>
      <body className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-bold text-slate-900">Si è verificato un errore</h1>
          <p className="mt-2 text-slate-600">Riprova tra poco. Se il problema persiste, contatta lo studio.</p>
          <p lang="en" className="mt-4 text-sm text-slate-500">
            Something went wrong. Please try again; if it keeps happening, contact the practice directly.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
          >
            Riprova · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
