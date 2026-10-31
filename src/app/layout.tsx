import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { siteUrl } from "@/lib/server/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: "/" },
  title: { default: "MagangHub Explorer — Temukan awal kariermu", template: "%s | MagangHub Explorer" },
  description: "Jelajahi lowongan Program Magang Nasional. Cari berdasarkan posisi, lokasi, pendidikan, dan minat. Periksa waktu pembaruan dan sumber resmi pada detail lowongan.",
  applicationName: "MagangHub Explorer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><a href="#main-content" className="skip-link">Lewati ke konten utama</a><TooltipProvider>{children}</TooltipProvider><Toaster theme="light" position="bottom-right" richColors closeButton mobileOffset={{ bottom: 86, left: 16, right: 16 }} toastOptions={{ closeButtonAriaLabel: "Tutup notifikasi" }} containerAriaLabel="Notifikasi" /></body>
    </html>
  );
}
