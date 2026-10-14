import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { isDemoMode } from "@/lib/demo";

/** Public pages with the site header and footer. The skip link (root layout) targets <main id="content">. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter demo={isDemoMode()} year={new Date().getFullYear()} />
    </>
  );
}
