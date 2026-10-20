import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { ClientProviders } from "@/components/providers/client-providers";

export const metadata: Metadata = {
  title: { default: "Lumos: meet new people right around you", template: "%s · Lumos" },
  description: "Discover interesting people nearby, start a conversation, and make new connections. Made in Sri Lanka.",
  applicationName: "Lumos",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keep the chat composer above the on-screen keyboard on mobile browsers.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0b13" },
  ],
};

// Runs before paint so the chosen theme never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem('lumos-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
