import { ArrowTopRightIcon } from "@radix-ui/react-icons";

export function SiteFooter() {
  return <footer className="site-footer site-container">
    <div><span className="footer-name">maganghub explorer</span><p>Dibuat untuk memudahkan langkah pertamamu.</p></div>
    <p>Proyek independen · Bukan situs resmi Kemnaker<br />Snapshot 31 Oktober 2026 · <a href="https://maganghub.kemnaker.go.id/" target="_blank" rel="noopener noreferrer">Sumber data <ArrowTopRightIcon className="inline size-3" /></a></p>
  </footer>;
}
