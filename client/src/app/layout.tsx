import type { Metadata } from "next";
import { Mitr, Noto_Sans_Thai } from "next/font/google";
import { AuthProvider } from "@/context/auth.context";
import CookieConsentPopup from "@/components/cookie-consent-popup";
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

export const metadata: Metadata = {
  title: "NUCARE | Student Mental Health Care System",
  description: "ระบบดูแลและติดตามสุขภาวะนักศึกษา คณะพยาบาลศาสตร์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} ${mitr.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <AuthProvider>
          <div className="min-h-screen">
            {children}
            <CookieConsentPopup />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
