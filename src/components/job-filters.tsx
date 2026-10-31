"use client";

import { useId, useState } from "react";
import { CheckIcon, ChevronDownIcon, MixerHorizontalIcon, ResetIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatNumber, type Facets, type Filters, type Option } from "@/lib/job-types";
import { cn } from "@/lib/utils";

export function SearchableSelect({ label, placeholder, options, value, onChange }: {
  label: string; placeholder: string; options: Option[]; value: string; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = options.find(option => option.value === value);
  return <div className="filter-field">
    <label id={`${id}-label`}>{label}</label>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-labelledby={`${id}-label`} className={cn("filter-select", !selected && "placeholder-value")}>
          <span className="truncate">{selected?.label ?? placeholder}</span><ChevronDownIcon className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[max(260px,var(--radix-popover-trigger-width))] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} aria-label={`Cari ${label.toLowerCase()}`} />
          <CommandList id={`${id}-options`}><CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup><CommandItem value={`semua ${label}`} onSelect={() => { onChange(""); setOpen(false); }}>
              <CheckIcon className={cn("size-4", value !== "" && "opacity-0")} />{placeholder}
            </CommandItem>
              {options.map(option => <CommandItem key={option.value} value={`${option.label} ${option.value}`} onSelect={() => { onChange(option.value); setOpen(false); }}>
                <CheckIcon className={cn("size-4 shrink-0", option.value !== value && "opacity-0")} />
                <span>{option.label}</span><span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{option.count !== undefined ? formatNumber(option.count) : ""}</span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}

export function FilterSelect({ label, value, options, placeholder, onChange }: {
  label: string; value: string; options: Option[]; placeholder: string; onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className="filter-field"><label htmlFor={id}>{label}</label>
    <Select value={value || "all"} onValueChange={value => onChange(value === "all" ? "" : value)}>
      <SelectTrigger id={id} className="filter-select"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value="all">{placeholder}</SelectItem>{options.map(option => <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function JobFilters({ filters, facets, onChange, onReset }: {
  filters: Filters; facets: Facets; onChange: (patch: Partial<Filters>) => void; onReset: () => void;
}) {
  const id = useId();
  const cities = facets.cities.filter(city => !filters.prov || city.province === filters.prov);
  return <div className="filter-panel">
    <div className="filter-panel-heading"><h2><MixerHorizontalIcon />Filter lowongan</h2><Button variant="ghost" size="sm" onClick={onReset} className="reset-button"><ResetIcon />Reset</Button></div>
    <Separator />
    <div className="filter-section"><h3>Bidang pekerjaan</h3>
      <div className="category-options"><button type="button" className={cn("category-option", !filters.cat && "selected")} aria-pressed={!filters.cat} onClick={() => onChange({ cat: "" })}><span>Semua bidang</span><span>{formatNumber(facets.total)}</span></button>
        {facets.categories.map(category => <button type="button" key={category.value} className={cn("category-option", filters.cat === category.value && "selected")} aria-pressed={filters.cat === category.value} onClick={() => onChange({ cat: filters.cat === category.value ? "" : category.value })}><span>{category.label}</span><span>{formatNumber(category.count ?? 0)}</span></button>)}
      </div>
    </div>
    <Separator />
    <div className="filter-section space-y-4"><h3>Lokasi penempatan</h3>
      <SearchableSelect label="Provinsi" placeholder="Semua provinsi" value={filters.prov} options={facets.provinces} onChange={prov => onChange({ prov, city: "" })} />
      <SearchableSelect label="Kota / kabupaten" placeholder="Semua kota / kabupaten" value={filters.city} options={cities} onChange={city => onChange({ city })} />
    </div>
    <Separator />
    <div className="filter-section space-y-4"><h3>Kriteria lowongan</h3>
      <FilterSelect label="Penyelenggara" placeholder="Semua penyelenggara" value={filters.org} options={[{ value: "0", label: "Perusahaan" }, { value: "1", label: "Instansi pemerintah" }]} onChange={org => onChange({ org })} />
      <FilterSelect label="Jenjang pendidikan" placeholder="Semua jenjang" value={filters.edu} options={[{ value: "1", label: "Diploma" }, { value: "2", label: "Sarjana" }, { value: "4", label: "Profesi" }]} onChange={edu => onChange({ edu })} />
      <FilterSelect label="Tipe wawancara" placeholder="Semua tipe wawancara" value={filters.interview} options={[{ value: "1", label: "Daring (online)" }, { value: "2", label: "Tatap muka" }]} onChange={interview => onChange({ interview })} />
      <div className="filter-field"><label htmlFor={`${id}-quota`}>Kuota minimal</label><div className="quota-input"><Input id={`${id}-quota`} inputMode="numeric" type="number" min={0} max={1000000} placeholder="0" value={filters.minQuota} onChange={event => onChange({ minQuota: event.target.value === "" ? "" : String(Math.max(0, Math.min(1000000, Number(event.target.value) || 0))) })} /><span>peserta</span></div></div>
      <div className="disability-filter"><Checkbox id={`${id}-disability`} checked={filters.disability} onCheckedChange={checked => onChange({ disability: checked === true })} /><label htmlFor={`${id}-disability`}>Ramah disabilitas<span>Hanya tampilkan lowongan inklusif</span></label></div>
    </div>
    <p className="filter-note">Wawancara daring mengacu pada proses seleksi, bukan sistem kerja WFH.</p>
  </div>;
}
