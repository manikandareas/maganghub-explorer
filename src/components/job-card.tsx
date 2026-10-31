import Link from "next/link";
import { ArrowRightIcon, BackpackIcon, PersonIcon, SewingPinIcon, VideoIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/save-button";
import { CATEGORIES, formatNumber, type Job } from "@/lib/job-types";
import { cn } from "@/lib/utils";

export function OrganizationMark({ name, government = false }: { name: string; government?: boolean }) {
  const words = name.replace(/^(pt\.?|cv\.?|perseroan)\s+/i, "").split(/\s+/);
  const initials = words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const palette = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return <span className={cn("organization-mark", `mark-${palette}`)} aria-hidden="true">{government ? <BackpackIcon className="size-5" /> : initials}</span>;
}

export function JobCard({ job }: { job: Job }) {
  const category = CATEGORIES.find(category => category.value === job.category);
  return <article className="job-card">
    <div className="job-card-top">
      <OrganizationMark name={job.organization} government={job.organizationType === 1} />
      <div className="job-organization"><p>{job.organization}</p><span>{job.organizationType ? "Instansi pemerintah" : "Perusahaan"}</span></div>
      <SaveButton id={job.id} title={job.title} />
    </div>
    <h3><Link href={`/lowongan/${job.id}`} prefetch={false}>{job.title}</Link></h3>
    <p className="job-location"><SewingPinIcon />{job.city}, {job.province}</p>
    <div className="job-tags">
      {job.education.map(label => <Badge key={label} variant="secondary">{label}</Badge>)}
      {job.interview.includes("Daring") ? <Badge variant="outline"><VideoIcon />Wawancara daring</Badge> : <Badge variant="outline">Wawancara tatap muka</Badge>}
      {job.disability ? <Badge variant="secondary" className="accessible-tag">Ramah disabilitas</Badge> : null}
    </div>
    <p className="job-programs" title={job.programs.join(", ")}>{job.programs.slice(0, 2).join(" · ")}{job.programs.length > 2 ? ` +${job.programs.length - 2} prodi` : ""}</p>
    <div className="job-card-bottom"><div className="job-numbers"><span><BackpackIcon /><strong>{formatNumber(job.quota)}</strong> kuota</span><span><PersonIcon /><strong>{formatNumber(job.applicants)}</strong> pelamar</span></div>
      <Link href={`/lowongan/${job.id}`} prefetch={false} className="detail-link" aria-label={`Lihat detail ${job.title}`}>Lihat detail <ArrowRightIcon /></Link>
    </div>
    <span className="sr-only">Kategori: {category?.label}</span>
  </article>;
}
