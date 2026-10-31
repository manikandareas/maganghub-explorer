import Link from "next/link";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return <><SiteHeader /><main id="main-content" className="site-container py-20"><div className="empty-state"><MagnifyingGlassIcon /><h1 className="text-2xl tracking-tight">Lowongan tidak ditemukan</h1><p>Tautan ini tidak cocok dengan lowongan dalam snapshot. Cari kesempatan lainnya di halaman eksplorasi.</p><Button asChild><Link href="/">Kembali ke eksplorasi</Link></Button></div></main><SiteFooter /></>;
}
