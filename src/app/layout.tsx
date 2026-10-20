import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { themeInitScript } from "@/components/theme";
import "./globals.css";

// Exposed as --font-inter; globals.css builds --font-sans from it. (Naming both --font-sans made the
// variable refer to itself, which browsers treat as invalid, so Inter was downloaded but never used.)
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Forma | School management", template: "%s" },
  description: "A unified learning and school management platform.",
  applicationName: "Forma",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f17" },
  ],
};

// Restores the saved theme and sidebar width before first paint.
const bootScript = `${themeInitScript}(function(){try{var s=localStorage.getItem("forma-sidebar");if(s==="collapsed")document.documentElement.setAttribute("data-sidebar","collapsed");}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
