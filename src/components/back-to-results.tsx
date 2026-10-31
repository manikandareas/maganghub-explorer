"use client";

import { ArrowLeftIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackToResults() {
  const router = useRouter();
  return <Link href="/" className="back-link" onClick={event => {
    // In-app links record their search URL, so returning preserves all filters.
    let previous: string | null = null;
    try { previous = sessionStorage.getItem("maganghub:last-search"); } catch { /* Fall back to the home link. */ }
    if (previous?.startsWith("/") && !previous.startsWith("//")) {
      event.preventDefault(); router.push(previous);
    }
  }}><ArrowLeftIcon />Kembali ke eksplorasi</Link>;
}
