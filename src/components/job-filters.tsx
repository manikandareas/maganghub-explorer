"use client";

import { useId, useState } from "react";
import { CheckIcon, ChevronDownIcon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { type Facets, type Filters, type Option } from "@/lib/job-types";
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
              {options.map(option => <CommandItem key={option.value} value={`${option.label} ${option.value} ${(option.keywords ?? []).join(" ")}`} onSelect={() => { onChange(option.value); setOpen(false); }}>
                <CheckIcon className={cn("size-4 shrink-0", option.value !== value && "opacity-0")} />
                <span>{option.label}</span>
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
  const advancedCount = Number(Boolean(filters.interview)) + Number(Number(filters.minQuota) > 0) + Number(filters.disability);
  const hasFilters = Boolean(filters.cat || filters.prov || filters.city || filters.edu || filters.org || advancedCount);
  return <div className="filter-panel">
    <div className="filter-panel-heading"><h2><MixerHorizontalIcon />Filter</h2>{hasFilters ? <Button variant="ghost" size="sm" onClick={onReset} className="reset-button">Reset</Button> : null}</div>
    <div className="filter-section space-y-4">
      <SearchableSelect label="Bidang" placeholder="Semua bidang" value={filters.cat} options={facets.categories} onChange={cat => onChange({ cat })} />
      <p className="-mt-2 text-xs text-muted-foreground">Bidang diperkirakan dari judul posisi.</p>
      <SearchableSelect label="Provinsi" placeholder="Semua provinsi" value={filters.prov} options={facets.provinces} onChange={prov => onChange({ prov, city: "" })} />
      <SearchableSelect label="Kota / kabupaten" placeholder="Semua kota / kabupaten" value={filters.city} options={cities} onChange={city => onChange({ city })} />
      <FilterSelect label="Jenjang pendidikan" placeholder="Semua jenjang" value={filters.edu} options={[{ value: "1", label: "Diploma" }, { value: "2", label: "Sarjana" }, { value: "4", label: "Profesi" }]} onChange={edu => onChange({ edu })} />
      <FilterSelect label="Penyelenggara" placeholder="Semua penyelenggara" value={filters.org} options={[{ value: "0", label: "Perusahaan" }, { value: "1", label: "Instansi pemerintah" }]} onChange={org => onChange({ org })} />
    </div>
    <Separator />
    <details className="advanced-filters" open={advancedCount > 0 || undefined}>
      <summary><span>Filter lainnya{advancedCount ? <span className="filter-count">{advancedCount}</span> : null}</span><ChevronDownIcon /></summary>
      <div className="filter-section space-y-4">
      <FilterSelect label="Wawancara" placeholder="Semua tipe" value={filters.interview} options={[{ value: "1", label: "Daring" }, { value: "2", label: "Tatap muka" }]} onChange={interview => onChange({ interview })} />
      <div className="filter-field"><label htmlFor={`${id}-quota`}>Kuota minimal</label><div className="quota-input"><Input id={`${id}-quota`} inputMode="numeric" type="number" min={0} max={1000000} placeholder="0" value={filters.minQuota} onChange={event => onChange({ minQuota: event.target.value === "" ? "" : String(Math.max(0, Math.min(1000000, Number(event.target.value) || 0))) })} /><span>peserta</span></div></div>
      <div className="disability-filter"><Checkbox id={`${id}-disability`} checked={filters.disability} onCheckedChange={checked => onChange({ disability: checked === true })} /><label htmlFor={`${id}-disability`}>Ramah disabilitas</label></div>
      </div>
    </details>
  </div>;
}
