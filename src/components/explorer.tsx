"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRightIcon, ArrowTopRightIcon, BookmarkIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon, InfoCircledIcon, MagnifyingGlassIcon, MixerHorizontalIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { JobFilters } from "@/components/job-filters";
import { JobCard } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { CATEGORIES, DEFAULT_FILTERS, SORT_OPTIONS, filterParams, formatNumber, parseFilters, type Facets, type Filters, type SearchResult, type Sort } from "@/lib/job-types";

const fetcher = async (url: string): Promise<SearchResult> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Tidak dapat memuat lowongan");
  return response.json();
};

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

export function Explorer({ facets, initialFilters, initialResult }: { facets: Facets; initialFilters: Filters; initialResult: SearchResult }) {
  const [filters, setFilters] = useState(initialFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const { ids } = useSavedJobs();
  const query = useDebouncedValue(filters.q);
  const params = filterParams({ ...filters, q: query });
  if (filters.saved) params.set("ids", ids.join(","));
  const { data = initialResult, error, isValidating, mutate } = useSWR<SearchResult>(`/api/jobs?${params}`, fetcher, {
    fallbackData: initialResult, keepPreviousData: true, revalidateOnFocus: false,
  });
  const loading = isValidating || filters.q !== query;

  useEffect(() => {
    try { sessionStorage.setItem("maganghub:last-search", `/${window.location.search}`); } catch { /* Storage is optional. */ }
  }, [filters]);

  useEffect(() => {
    const onPop = () => setFilters(parseFilters(new URLSearchParams(window.location.search)));
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, []);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, page: 1, ...patch };
    setFilters(next);
    const query = filterParams(next).toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }
  function reset() { update({ ...DEFAULT_FILTERS, saved: filters.saved }); }
  function navigatePage(page: number) {
    update({ page });
    resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  const chips: { key: keyof Filters; label: string; reset: Partial<Filters> }[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, reset: { q: "" } });
  if (filters.cat) chips.push({ key: "cat", label: CATEGORIES.find(c => c.value === filters.cat)?.label ?? "", reset: { cat: "" } });
  if (filters.prov) chips.push({ key: "prov", label: facets.provinces.find(p => p.value === filters.prov)?.label ?? "", reset: { prov: "", city: "" } });
  if (filters.city) chips.push({ key: "city", label: facets.cities.find(c => c.value === filters.city)?.label ?? "", reset: { city: "" } });
  if (filters.org) chips.push({ key: "org", label: filters.org === "1" ? "Instansi pemerintah" : "Perusahaan", reset: { org: "" } });
  if (filters.edu) chips.push({ key: "edu", label: ({ "1": "Diploma", "2": "Sarjana", "4": "Profesi" })[filters.edu] ?? "", reset: { edu: "" } });
  if (filters.interview) chips.push({ key: "interview", label: filters.interview === "1" ? "Wawancara daring" : "Tatap muka", reset: { interview: "" } });
  if (filters.minQuota && filters.minQuota !== "0") chips.push({ key: "minQuota", label: `Kuota ≥ ${filters.minQuota}`, reset: { minQuota: "" } });
  if (filters.disability) chips.push({ key: "disability", label: "Ramah disabilitas", reset: { disability: false } });
  const filterCount = chips.filter(chip => chip.key !== "q").length;
  const pageNumbers = [...new Set([1, data.page - 1, data.page, data.page + 1, data.pages])].filter(page => page > 0 && page <= data.pages).sort((a, b) => a - b);

  return <>
    <SiteHeader saved={filters.saved} onNavigate={saved => update({ saved })} />
    <main id="main-content">
      <section className="explorer-hero"><div className="site-container">
        <div className="hero-heading-row"><div>
          <div className="program-label"><span className="status-dot" />Program Magang Nasional <span className="program-batch">Batch 3 · 2026</span></div>
          <h1>Langkah kecil hari ini.<br /><span>Awal besar untuk kariermu.</span></h1>
          <p className="hero-description">Temukan kesempatan magang yang sesuai dengan minat dan latar belakangmu.<br className="desktop-break" /> Jelajahi {formatNumber(facets.total)} lowongan, dalam satu tempat.</p>
        </div><div className="deadline-note"><CalendarIcon className="size-5" /><div><span>Batas pelamaran di snapshot</span><strong>4 November 2026</strong><p>Cek ketersediaan di portal resmi.</p></div></div></div>
        <form className="search-form" role="search" onSubmit={event => { event.preventDefault(); searchRef.current?.blur(); resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }}>
          <MagnifyingGlassIcon className="search-icon" /><label htmlFor="job-search" className="sr-only">Cari lowongan</label>
          <Input ref={searchRef} id="job-search" type="search" autoComplete="off" placeholder="Cari posisi, perusahaan, lokasi, atau program studi..." value={filters.q} onChange={event => update({ q: event.target.value.slice(0, 250) })} />
          <kbd aria-hidden="true">/</kbd><Button type="submit" className="search-submit">Cari lowongan <ArrowRightIcon /></Button>
        </form>
        <div className="suggested-searches"><span>Coba cari:</span>{["Data analyst", "Administrasi", "Software engineer", "Akuntansi"].map(term => <button type="button" key={term} onClick={() => update({ q: term })}>{term}<ArrowTopRightIcon /></button>)}</div>
      </div></section>

      <div className="site-container explorer-layout">
        <aside className="desktop-filters" aria-label="Filter lowongan"><JobFilters filters={filters} facets={facets} onChange={update} onReset={reset} /></aside>
        <section className="results-section" ref={resultsRef} aria-label="Hasil pencarian lowongan">
          <div className="results-toolbar"><div><h2>{filters.saved ? "Lowongan tersimpan" : "Eksplorasi lowongan"}</h2>
            <p role="status" aria-live="polite">{loading ? "Mencari lowongan yang sesuai..." : <><strong>{formatNumber(data.total)}</strong> lowongan{chips.length ? " sesuai pencarianmu" : " untuk langkah berikutnya"}</>}</p>
          </div><div className="results-actions">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}><SheetTrigger asChild><Button variant="outline" className="mobile-filter-trigger"><MixerHorizontalIcon />Filter{filterCount > 0 ? <span className="filter-count">{filterCount}</span> : null}</Button></SheetTrigger>
              <SheetContent side="left" className="mobile-filter-sheet"><SheetHeader><SheetTitle>Sesuaikan pencarianmu</SheetTitle><SheetDescription>Pilih kriteria lowongan yang kamu cari.</SheetDescription></SheetHeader>
                <div className="mobile-filter-scroll"><JobFilters filters={filters} facets={facets} onChange={update} onReset={reset} /></div>
                <SheetFooter><Button onClick={() => setSheetOpen(false)} className="h-11">{loading ? "Memuat hasil..." : `Tampilkan ${formatNumber(data.total)} lowongan`}<ArrowRightIcon /></Button></SheetFooter>
              </SheetContent>
            </Sheet>
            <label className="sort-label" htmlFor="sort-jobs">Urutkan:</label>
            <Select value={filters.sort} onValueChange={sort => update({ sort: sort as Sort })}><SelectTrigger id="sort-jobs" className="sort-select" aria-label="Urutkan lowongan"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end">{SORT_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
          </div></div>
          {chips.length ? <div className="active-filters" aria-label="Filter aktif">{chips.map(chip => <Badge variant="secondary" key={chip.key} asChild><button type="button" onClick={() => update(chip.reset)} aria-label={`Hapus filter ${chip.label}`}>{chip.label}<Cross2Icon className="size-3" /></button></Badge>)}<button type="button" className="clear-filters" onClick={reset}>Hapus semua</button></div> : null}
          <div className="snapshot-note"><InfoCircledIcon /><p>Data snapshot <strong>31 Oktober 2026</strong>. Kuota dan pelamar dapat berubah di portal resmi.</p><span className="snapshot-label">Snapshot</span></div>
          {error ? <div className="empty-state" role="alert"><InfoCircledIcon /><h3>Lowongan belum bisa dimuat</h3><p>Periksa koneksi, lalu coba muat kembali pencarianmu.</p><Button variant="outline" onClick={() => mutate()}><UpdateIcon />Coba lagi</Button></div> : data.total === 0 ?
            <div className="empty-state">{filters.saved ? <BookmarkIcon /> : <MagnifyingGlassIcon />}<h3>{filters.saved && !ids.length ? "Simpan kesempatan yang menarik" : "Belum ada lowongan yang cocok"}</h3><p>{filters.saved && !ids.length ? "Klik ikon simpan pada lowongan. Kamu bisa menemukannya kembali di sini, di perangkat yang sama." : "Coba kata kunci lain atau kurangi filter agar lebih banyak kesempatan muncul."}</p><Button variant="outline" onClick={filters.saved && !ids.length ? () => update({ ...DEFAULT_FILTERS }) : reset}>{filters.saved && !ids.length ? "Jelajahi lowongan" : "Reset pencarian"}<ArrowRightIcon /></Button></div>
            : <div className="job-grid" aria-busy={loading} data-loading={loading}>{data.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>}
          {!error && data.total > 0 ? <div className="pagination-bar"><p>Menampilkan {formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber(Math.min(data.page * data.pageSize, data.total))} dari {formatNumber(data.total)}</p>
            <nav aria-label="Halaman hasil" className="pagination"><Button variant="outline" size="icon" disabled={data.page === 1 || loading} onClick={() => navigatePage(data.page - 1)} aria-label="Halaman sebelumnya"><ChevronLeftIcon /></Button>
              {pageNumbers.map((page, index) => <span key={page} className="pagination-item">{index > 0 && page - pageNumbers[index - 1] > 1 ? <span className="pagination-ellipsis">…</span> : null}<Button variant={data.page === page ? "default" : "ghost"} size="icon" disabled={loading} aria-label={`Halaman ${page}`} aria-current={data.page === page ? "page" : undefined} onClick={() => navigatePage(page)}>{page}</Button></span>)}
              <Button variant="outline" size="icon" disabled={data.page === data.pages || loading} onClick={() => navigatePage(data.page + 1)} aria-label="Halaman berikutnya"><ChevronRightIcon /></Button>
            </nav></div> : null}
          <div className="results-endnote"><span className="status-dot" />{facets.provinces.length} provinsi · {formatNumber(facets.organizations)} penyelenggara · Kesempatan untuk bertumbuh</div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </>;
}
