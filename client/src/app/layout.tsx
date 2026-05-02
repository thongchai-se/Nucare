import { Mitr, Noto_Sans_Thai } from "next/font/google";
import { AuthProvider } from "@/context/auth.context";
import CookieConsentPopup from "@/components/cookie-consent-popup";
import { rootMetadata } from "@/lib/site-metadata";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const mitr = Mitr({
  subsets: ["thai", "latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} ${mitr.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <AuthProvider>
          <a
            href="#main-content"
            className="sr-only fixed left-4 top-4 z-[250] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-lg focus:not-sr-only"
          >
            ข้ามไปยังเนื้อหาหลัก
          </a>
          <div id="main-content" tabIndex={-1} className="min-h-screen">
            {children}
            <CookieConsentPopup />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
