"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main-content" className="site-container py-20"><div className="empty-state" role="alert"><h1 className="text-2xl tracking-tight">Halaman belum bisa dimuat</h1><p>Terjadi kendala saat membaca data. Coba muat kembali halaman ini.</p><Button onClick={reset}>Coba lagi</Button></div></main>;
}
