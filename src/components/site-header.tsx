"use client";

import Link from "next/link";
import { ArrowTopRightIcon, BookmarkIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { cn } from "@/lib/utils";

export function Brand() {
  return <Link href="/" className="brand" aria-label="MagangHub Explorer, halaman utama">
    <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
    <span>maganghub<span className="brand-divider">/</span><span className="brand-suffix">explorer</span></span>
  </Link>;
}

export function SiteHeader({ saved = false, onNavigate }: { saved?: boolean; onNavigate?: (saved: boolean) => void }) {
  const { ids } = useSavedJobs();
  return <header className="site-header">
    <div className="site-container header-inner">
      <Brand />
      <nav aria-label="Navigasi utama" className="header-nav">
        <Link href="/" className={cn("nav-link", !saved && "active")} aria-current={!saved ? "page" : undefined}
          onClick={onNavigate ? e => { e.preventDefault(); onNavigate(false); } : undefined}>Eksplorasi</Link>
        <Link href="/?saved=1" className={cn("nav-link", saved && "active")} aria-current={saved ? "page" : undefined}
          onClick={onNavigate ? e => { e.preventDefault(); onNavigate(true); } : undefined}>
          <BookmarkIcon className="size-4" /><span>Tersimpan</span><span className="saved-count">{ids.length}</span>
        </Link>
      </nav>
      <Button variant="outline" size="sm" asChild className="official-link">
        <a href="https://maganghub.kemnaker.go.id/" target="_blank" rel="noopener noreferrer">Portal resmi <ArrowTopRightIcon /></a>
      </Button>
    </div>
  </header>;
}
