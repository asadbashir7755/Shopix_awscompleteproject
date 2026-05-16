import type { Metadata } from "next";
import "./globals.css";
import Chatbot from "../components/Chatbot";
import CookieConsent from "../components/Cookies/CookieConsent";
import AppProviders from "./AppProviders";
import { initDb } from "../lib/initDb";

export const metadata: Metadata = {
  title: "Shopix- E-commerce platform",
  description: "Shopix is a e-commerce platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize database on app startup (don't fail build if DB is unreachable)
  try {
    await initDb();
  } catch (e) {
    console.error('initDb() failed during startup (continuing):', (e as Error).message);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          {children}
          <Chatbot />
          <CookieConsent />
        </AppProviders>
      </body>
    </html>
  );
}
