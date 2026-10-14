import { headers } from "next/headers";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { isDemoMode } from "@/lib/demo";

/**
 * Public pages with the site header and footer. The skip link (root layout) targets <main id="content">.
 * The query string comes from the proxy (x-search, never client-controlled): the language
 * switchers keep it in their links even without JavaScript.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const search = (await headers()).get("x-search") ?? "";
  return (
    <>
      <SiteHeader search={search} />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter demo={isDemoMode()} year={new Date().getFullYear()} search={search} />
    </>
  );
}
