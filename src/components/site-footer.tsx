import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer site-container">
    <p>Bukan situs resmi Kemnaker.</p>
    <Link href="/api-docs">API publik & panduan AI</Link>
    <a href="https://maganghub.kemnaker.go.id/" target="_blank" rel="noopener noreferrer">Sumber data: MagangHub Kemnaker <ArrowTopRightIcon className="inline size-3" /></a>
  </footer>;
}
