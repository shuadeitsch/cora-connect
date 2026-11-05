import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { BrowserBanner } from "@/components/browser-banner";
import { Pwa } from "@/components/pwa";
import { ToastProvider } from "@/components/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const themeBoot = `(function(){try{var p=localStorage.getItem("cora-palette");if(p&&p!=="classic"&&p!=="dark")document.documentElement.setAttribute("data-palette",p);var t=localStorage.getItem("cora-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");if(matchMedia("(display-mode: standalone)").matches||navigator.standalone)document.documentElement.classList.add("standalone")}catch(e){}})()`;

export const metadata: Metadata = {
  title: { default: "Cora Connect", template: "%s · Cora Connect" },
  description: "Cora Connect keeps household contacts for Chabad Outreach to Rural America.",
  applicationName: "Cora Connect",
  appleWebApp: {
    capable: true,
    title: "Cora Connect",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${fraunces.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="antialiased">
        <BrowserBanner />
        <TooltipProvider>
          <ToastProvider>
            {children}
            <Pwa />
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
