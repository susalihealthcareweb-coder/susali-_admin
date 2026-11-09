import { Montserrat, Cormorant_Garamond, Cinzel } from "next/font/google";
import "./globals.css";
import Toaster from "@/components/Toaster";
import PwaRegister from "@/components/PwaRegister";

// Fonts chosen to match the logo: Cinzel wordmark, Cormorant headings, Montserrat text.
const body = Montserrat({ variable: "--font-body", subsets: ["latin"] });
const heading = Cormorant_Garamond({ variable: "--font-heading", subsets: ["latin"], weight: ["600", "700"] });
const wordmark = Cinzel({ variable: "--font-wordmark", subsets: ["latin"], weight: ["600", "700"] });

export const metadata = {
  title: { default: "SUSALI", template: "%s · SUSALI" },
  description: "SUSALI Healthcare: referral management from dispensary to hospital and back. Healthier lives ahead.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "SUSALI", statusBarStyle: "default" },
  icons: { icon: "/icons/favicon-48.png", apple: "/icons/apple-touch.png" },
};

export const viewport = { themeColor: "#0b4633", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${wordmark.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
