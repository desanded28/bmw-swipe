import { notFound } from "next/navigation";

/** Unknown paths under a locale render [locale]/not-found inside the locale's root layout. */
export default function CatchAll() {
  notFound();
}
