"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRightIcon, BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon, InfoCircledIcon, MagnifyingGlassIcon, MixerHorizontalIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { JobFilters } from "@/components/job-filters";
import { JobCard } from "@/components/job-card";
import { CopyForAgentButton } from "@/components/copy-for-agent-button";
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
  const initialParams = filterParams(initialFilters);
  if (initialFilters.saved) initialParams.set("ids", "");
  const { data: result, error, isValidating, mutate } = useSWR<SearchResult>(`/api/jobs?${params}`, fetcher, {
    fallback: { [`/api/jobs?${initialParams}`]: initialResult }, revalidateOnFocus: false,
  });
  const data = result ?? initialResult;
  const lastIngestedAt = data.meta?.lastIngestedAt;
  const dataDate = lastIngestedAt ? new Date(lastIngestedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "31 Okt 2026";
  const pending = filters.q !== query || !result;
  const loading = isValidating || pending;

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
  function reset() { update({ ...DEFAULT_FILTERS, q: filters.q, sort: filters.sort, saved: filters.saved }); }
  function navigatePage(page: number) {
    update({ page });
    resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  const chips: { key: keyof Filters; label: string; reset: Partial<Filters> }[] = [];
  if (filters.cat) chips.push({ key: "cat", label: CATEGORIES.find(c => c.value === filters.cat)?.label ?? "", reset: { cat: "" } });
  if (filters.prov) chips.push({ key: "prov", label: facets.provinces.find(p => p.value === filters.prov)?.label ?? "", reset: { prov: "", city: "" } });
  if (filters.city) chips.push({ key: "city", label: facets.cities.find(c => c.value === filters.city)?.label ?? "", reset: { city: "" } });
  if (filters.org) chips.push({ key: "org", label: filters.org === "1" ? "Instansi pemerintah" : "Perusahaan", reset: { org: "" } });
  if (filters.edu) chips.push({ key: "edu", label: ({ "1": "Diploma", "2": "Sarjana", "4": "Profesi" })[filters.edu] ?? "", reset: { edu: "" } });
  if (filters.interview) chips.push({ key: "interview", label: filters.interview === "1" ? "Wawancara daring" : "Tatap muka", reset: { interview: "" } });
  if (filters.minQuota && filters.minQuota !== "0") chips.push({ key: "minQuota", label: `Kuota ≥ ${filters.minQuota}`, reset: { minQuota: "" } });
  if (filters.disability) chips.push({ key: "disability", label: "Ramah disabilitas", reset: { disability: false } });
  const filterCount = chips.length;
  const pageNumbers = [...new Set([1, data.page - 1, data.page, data.page + 1, data.pages])].filter(page => page > 0 && page <= data.pages).sort((a, b) => a - b);

  return <>
    <SiteHeader saved={filters.saved} onNavigate={saved => update({ saved })} />
    <main id="main-content">
      <section className="explorer-hero"><div className="site-container">
        <div className="hero-heading-row"><div>
          <h1>Cari lowongan magang</h1>
          <p className="hero-description">Program Magang Nasional · Batch 3, 2026</p>
        </div><Popover><PopoverTrigger asChild><Button variant="ghost" className="data-info">Data {dataDate}<InfoCircledIcon /></Button></PopoverTrigger>
          <PopoverContent align="end" className="text-xs leading-relaxed">{lastIngestedAt ? "Tanggal ini adalah pembaruan batch terakhir. Sebagian lowongan masih memakai snapshot awal 31 Oktober 2026. " : "Data tersimpan per 31 Oktober 2026. "}Kuota dan pelamar dapat berubah. Batas pelamaran pada snapshot awal: 4 November 2026. Cek ketersediaan di portal resmi.</PopoverContent>
        </Popover></div>
        <div className="hero-agent-action"><CopyForAgentButton /></div>
        <form className="search-form" role="search" onSubmit={event => { event.preventDefault(); searchRef.current?.blur(); resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }}>
          <MagnifyingGlassIcon className="search-icon" /><label htmlFor="job-search" className="sr-only">Cari lowongan</label>
          <Input ref={searchRef} id="job-search" type="search" autoComplete="off" placeholder="Cari posisi, perusahaan, atau keahlian" value={filters.q} onChange={event => update({ q: event.target.value.slice(0, 250) })} />
          <Button type="submit" className="search-submit">Cari <ArrowRightIcon /></Button>
        </form>
      </div></section>

      <div className="site-container explorer-layout">
        <aside className="desktop-filters" aria-label="Filter lowongan" tabIndex={0}><JobFilters filters={filters} facets={facets} onChange={update} onReset={reset} /></aside>
        <section className="results-section" ref={resultsRef} aria-label="Hasil pencarian lowongan">
          <div className="results-toolbar"><div>
            <h2 role="status" aria-live="polite">{pending ? "Mencari..." : `${formatNumber(data.total)} lowongan${filters.saved ? " tersimpan" : ""}`}</h2>
          </div><div className="results-actions">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}><SheetTrigger asChild><Button variant="outline" className="mobile-filter-trigger"><MixerHorizontalIcon />Filter{filterCount > 0 ? <span className="filter-count">{filterCount}</span> : null}</Button></SheetTrigger>
              <SheetContent side="left" className="mobile-filter-sheet" aria-describedby={undefined}><SheetTitle className="sr-only">Filter lowongan</SheetTitle>
                <div className="mobile-filter-scroll"><JobFilters filters={filters} facets={facets} onChange={update} onReset={reset} /></div>
                <SheetFooter><Button onClick={() => setSheetOpen(false)} className="h-11">{pending ? "Mencari..." : `Lihat ${formatNumber(data.total)} lowongan`}<ArrowRightIcon /></Button></SheetFooter>
              </SheetContent>
            </Sheet>
            <Select value={filters.sort} onValueChange={sort => update({ sort: sort as Sort })}><SelectTrigger id="sort-jobs" className="sort-select" aria-label="Urutkan lowongan"><SelectValue>{SORT_OPTIONS.find(option => option.value === filters.sort)?.label ?? "Urutkan"}</SelectValue></SelectTrigger><SelectContent position="popper" align="end">{filters.sort !== "relevance" ? <SelectItem value="relevance">Reset urutan</SelectItem> : null}{SORT_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
          </div></div>
          {chips.length ? <div className="active-filters" aria-label="Filter aktif">{chips.map(chip => <Badge variant="secondary" key={chip.key} asChild><button type="button" onClick={() => update(chip.reset)} aria-label={`Hapus filter ${chip.label}`}>{chip.label}<Cross2Icon className="size-3" /></button></Badge>)}<button type="button" className="clear-filters" onClick={reset}>Hapus semua</button></div> : null}
          {!pending && data.meta?.fallbackReason ? <p className="mb-4 text-sm text-muted-foreground" role="status">Pencarian makna sementara tidak tersedia. Hasil menggunakan kata kunci.</p> : null}
          {error ? <div className="empty-state" role="alert"><InfoCircledIcon /><h3>Lowongan belum bisa dimuat</h3><p>Periksa koneksi, lalu coba lagi.</p><Button variant="outline" onClick={() => mutate()}><UpdateIcon />Coba lagi</Button></div> : pending ?
            <div className="job-grid" aria-busy="true" aria-label="Memuat hasil pencarian">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-64 rounded-lg" />)}</div> : data.total === 0 ?
            <div className="empty-state">{filters.saved ? <BookmarkIcon /> : <MagnifyingGlassIcon />}<h3>{filters.saved && !ids.length ? "Belum ada lowongan tersimpan" : "Tidak ada lowongan yang cocok"}</h3><p>{filters.saved && !ids.length ? "Klik ikon simpan pada lowongan untuk melihatnya di sini." : "Coba kata kunci lain atau kurangi filter."}</p><Button variant="outline" onClick={filters.saved && !ids.length ? () => update({ ...DEFAULT_FILTERS }) : chips.length ? reset : () => update({ q: "" })}>{filters.saved && !ids.length ? "Cari lowongan" : chips.length ? "Hapus filter" : "Hapus pencarian"}<ArrowRightIcon /></Button></div>
            : <div className="job-grid" aria-busy={loading} data-loading={loading}>{data.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>}
          {!error && !pending && data.total > 0 ? <div className="pagination-bar"><p>{formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber(Math.min(data.page * data.pageSize, data.total))} dari {formatNumber(data.total)}</p>
            <nav aria-label="Halaman hasil" className="pagination"><Button variant="outline" size="icon" disabled={data.page === 1 || loading} onClick={() => navigatePage(data.page - 1)} aria-label="Halaman sebelumnya"><ChevronLeftIcon /></Button>
              {pageNumbers.map((page, index) => <span key={page} className="pagination-item">{index > 0 && page - pageNumbers[index - 1] > 1 ? <span className="pagination-ellipsis">…</span> : null}<Button variant={data.page === page ? "default" : "ghost"} size="icon" disabled={loading} aria-label={`Halaman ${page}`} aria-current={data.page === page ? "page" : undefined} onClick={() => navigatePage(page)}>{page}</Button></span>)}
              <Button variant="outline" size="icon" disabled={data.page === data.pages || loading} onClick={() => navigatePage(data.page + 1)} aria-label="Halaman berikutnya"><ChevronRightIcon /></Button>
            </nav></div> : null}
        </section>
      </div>
    </main>
    <SiteFooter />
  </>;
}
