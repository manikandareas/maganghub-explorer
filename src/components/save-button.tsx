"use client";

import { BookmarkFilledIcon, BookmarkIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { cn } from "@/lib/utils";

export function SaveButton({ id, title, expanded = false }: { id: string; title: string; expanded?: boolean }) {
  const { ids, toggle } = useSavedJobs();
  const saved = ids.includes(id);
  const label = saved ? "Hapus dari tersimpan" : "Simpan lowongan";
  return <Tooltip><TooltipTrigger asChild>
    <Button variant={expanded ? "outline" : "ghost"} size={expanded ? "default" : "icon"}
      className={cn("save-button", saved && "is-saved")} aria-label={`${label}: ${title}`} aria-pressed={saved}
      onClick={() => {
        if (toggle(id)) toast.success(saved ? "Lowongan dihapus dari tersimpan" : "Lowongan tersimpan di perangkat ini");
        else toast.error("Penyimpanan tidak tersedia. Periksa izin browser kamu.");
      }}>
      {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}{expanded ? (saved ? "Tersimpan" : "Simpan lowongan") : null}
    </Button>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
