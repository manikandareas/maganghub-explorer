"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  return <Button variant="ghost" onClick={async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success("Tautan lowongan disalin"); }
    catch { toast.error("Tautan belum bisa disalin. Salin alamat dari browser kamu."); }
  }}><Share1Icon />Salin tautan lowongan</Button>;
}
