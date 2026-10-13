import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Book your dentist online`, template: `%s · ${APP_NAME}` },
  description:
    "Find a dentist near you, see real availability and book in seconds. Reminders by SMS, WhatsApp or email — confirm or reschedule with one tap.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c675d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
