import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowTopRightIcon, SewingPinIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrganizationMark } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SaveButton } from "@/components/save-button";
import { ShareButton } from "@/components/share-button";
import { BackToResults } from "@/components/back-to-results";
import { pageJob } from "@/lib/server/page-data";
import { formatNumber } from "@/lib/job-types";

type Props = { params: Promise<{ id: string }> };
const observedDate = (observedAt?: string | null) => observedAt ? new Date(observedAt).toLocaleDateString("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }) : "31 Oktober 2026";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await pageJob((await params).id);
  if (!job) notFound();
  return { title: `${job.title} — ${job.organization}`, description: `Lowongan magang ${job.title} di ${job.organization}, ${job.city}. Kuota ${job.quota} peserta. Data diambil ${observedDate(job.observedAt)}.`, alternates: { canonical: `/lowongan/${job.id}` } };
}

export default async function JobPage({ params }: Props) {
  const job = await pageJob((await params).id);
  if (!job) notFound();
  const facts = [
    ["Kuota peserta", `${formatNumber(job.quota)} orang`],
    ["Jumlah pelamar", `${formatNumber(job.applicants)} orang`],
    ["Pendidikan", job.education.join(", ")],
    ["Wawancara", job.interview.join(" / ")],
    ["Hari kerja", job.days ? `${job.days} hari / minggu` : "Tidak tercantum"],
    ["Penyelenggara", job.organizationType ? "Pemerintah" : "Perusahaan"],
  ];
  return <><SiteHeader /><main id="main-content" className="site-container detail-main"><BackToResults />
    <div className="detail-layout"><article>
      <div className="detail-heading"><div className="job-card-top"><OrganizationMark name={job.organization} government={Boolean(job.organizationType)} /><div className="job-organization"><p>{job.organization}</p><span>{job.organizationType ? "Instansi pemerintah" : "Perusahaan"}</span></div></div>
        <h1>{job.title}</h1><p className="job-location"><SewingPinIcon />{job.city}, {job.province}</p>
        <div className="job-tags">{job.education.map(label => <Badge variant="secondary" key={label}>{label}</Badge>)}{job.interview.map(type => <Badge variant="outline" key={type}>Wawancara {type.toLowerCase()}</Badge>)}{job.disability ? <Badge className="accessible-tag">Ramah disabilitas</Badge> : null}</div>
      </div>
      <div className="detail-content"><section><h2>Deskripsi</h2><p className="description-text">{job.description || "Deskripsi belum tersedia. Lihat rincian posisi di portal resmi MagangHub."}</p></section>
        <section><h2>Program studi</h2>{job.programs.length ? <div className="program-list">{job.programs.map((program, index) => <Badge variant="outline" key={`${program}-${index}`}>{program}</Badge>)}</div> : <p className="description-text">Program studi tidak tercantum.</p>}</section>
        <section><h2>Lokasi penempatan</h2><p className="description-text">{job.address || `${job.city}, ${job.province}`}</p><p className="detail-data-note">Portal tidak mencantumkan sistem kerja WFO / WFH. Wawancara daring berarti proses seleksi dilakukan online.</p></section>
      </div>
    </article>
    <aside className="detail-sidebar" aria-label="Ringkasan lowongan"><h2>Ringkasan lowongan</h2><dl className="detail-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <Button asChild className="apply-button"><a href={job.url} target="_blank" rel="noopener noreferrer">Lamar di portal resmi<ArrowTopRightIcon /></a></Button><SaveButton id={job.id} title={job.title} expanded />
      <p className="detail-sidebar-note">Data diambil {observedDate(job.observedAt)}. Batas pelamaran pada snapshot awal: <strong>4 November 2026</strong>. Cek ketersediaan di portal resmi.</p>
      <div className="detail-share"><ShareButton /></div>
    </aside></div>
    <div className="mobile-apply-bar"><SaveButton id={job.id} title={job.title} /><Button asChild><a href={job.url} target="_blank" rel="noopener noreferrer">Lamar di portal resmi<ArrowTopRightIcon /></a></Button></div>
  </main><SiteFooter /></>;
}
