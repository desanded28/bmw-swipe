import { Plus_Jakarta_Sans } from "next/font/google";

/**
 * Self-hosted at build time by next/font: no request to Google from the visitor's browser.
 * latin-ext covers Polish, Romanian, German and the other supported languages.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  display: "swap",
});
