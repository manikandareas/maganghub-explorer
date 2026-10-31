"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const AI_ICONS = ["chatgpt", "claude", "gemini"] as const;

function agentPrompt(origin: string) {
  return `Bantu saya mencari lowongan magang melalui MagangHub Explorer (${origin}).

Sebelum menjawab:
1. Baca panduan ${origin}/llms.txt, lalu dokumentasi API yang dirujuk di sana (${origin}/openapi.json). Gunakan API publik untuk mencari data, bukan menebak lowongan.
2. Baca ${origin}/api/v1/facets untuk nilai filter yang valid. Gunakan pencarian hybrid dan filter terstruktur untuk lokasi, bidang, atau pendidikan yang saya minta. Jika informasi penting belum jelas, tanyakan kepada saya.
3. Baca detail lowongan sebelum menjelaskan persyaratannya. Berikan maksimal 5 rekomendasi yang relevan, disertai posisi, penyelenggara, lokasi, alasan kecocokan, serta tautan detail dan sumber resmi.
4. Sebutkan tanggal snapshot dari metadata. Data ini bukan ketersediaan live; jangan mengarang persyaratan atau menjanjikan penerimaan. Wawancara daring tidak berarti magang WFH.
5. Jika kamu tidak bisa mengakses URL atau API, jelaskan batas aksesnya dan minta saya menempelkan panduan atau data yang diperlukan. Jangan mengklaim sudah membaca sumber yang belum diakses.

Pertanyaan saya:
{pertanyaan kamu di sini, contoh: Cari magang marketing di Makassar untuk lulusan S1 Manajemen}

Jika pertanyaan masih berupa placeholder di atas, minta saya menggantinya dengan pertanyaan saya sendiri.`;
}

export function CopyForAgentButton() {
  const [status, setStatus] = useState<"idle" | "copying" | "copied">("idle");
  const [manualPrompt, setManualPrompt] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copyPrompt() {
    if (timer.current) clearTimeout(timer.current);
    const prompt = agentPrompt(window.location.origin);
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
      toast.success("Prompt disalin", { description: "Tempel di AI pilihanmu, lalu ganti bagian pertanyaannya." });
      timer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("idle");
      setManualPrompt(prompt);
    }
  }

  return <>
    <Button ref={buttonRef} type="button" variant="outline" className="agent-copy-button rounded-full" onClick={copyPrompt} disabled={status === "copying"} aria-busy={status === "copying"} title="Salin prompt untuk ChatGPT, Claude, atau Gemini" data-copied={status === "copied"}>
      <span className="agent-icon-stack" aria-hidden="true">{AI_ICONS.map(name => <Avatar className="agent-icon rounded-full" key={name}>
        <AvatarImage src={`/icons/ai/${name}.png`} alt="" />
        <AvatarFallback>{name[0].toUpperCase()}</AvatarFallback>
      </Avatar>)}</span>
      <span className="agent-copy-label">Copy for agent</span>
      <span className="agent-copy-status" aria-hidden="true">{status === "copied" ? <CheckIcon /> : <CopyIcon />}</span>
    </Button>
    <Dialog open={Boolean(manualPrompt)} onOpenChange={open => { if (!open) setManualPrompt(""); }}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={event => { event.preventDefault(); buttonRef.current?.focus(); }}>
        <DialogHeader><DialogTitle>Salin prompt secara manual</DialogTitle><DialogDescription>Browser belum mengizinkan salin otomatis. Salin teks di bawah, tempel di AI pilihanmu, lalu ganti bagian pertanyaannya.</DialogDescription></DialogHeader>
        <Textarea aria-label="Prompt untuk AI" value={manualPrompt} readOnly onFocus={event => event.currentTarget.select()} className="h-64 resize-none text-sm [field-sizing:fixed]" />
      </DialogContent>
    </Dialog>
  </>;
}
