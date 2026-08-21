"use client";

import { useState } from "react";
import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RelatoriosClient({ fazendas }: { fazendas: Array<{ id: string; nome: string; armadilhas: number }> }) {
  const hoje = new Date();
  const [fazenda, setFazenda] = useState(fazendas[0]?.id ?? "");
  const [de, setDe] = useState(new Date(hoje.getTime() - 30 * 864e5).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));

  const url = `/laudo?${new URLSearchParams({ fazenda, de, ate })}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-texto-suave mt-1">Laudo técnico por fazenda e período: resumo, mapa, tabela por talhão, evolução semanal, septos vencidos e fotos auditáveis.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Gerar laudo</CardTitle><CardDescription>Abre o laudo pronto para impressão — use “Salvar como PDF” no navegador para enviar à usina.</CardDescription></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="grid gap-1.5 sm:col-span-3">
              <Label>Fazenda</Label>
              <Select value={fazenda} onValueChange={(v) => v && setFazenda(v)}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome} · {f.armadilhas} armadilhas</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="de">De</Label><Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ate">Até</Label><Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            <div className="flex items-end gap-2">
              <Button render={<a href={url} target="_blank" rel="noreferrer" />} disabled={!fazenda}><FileText /> Abrir laudo</Button>
            </div>
            <p className="sm:col-span-3 text-xs text-texto-suave flex items-center gap-1.5"><Printer size={14} /> No laudo, clique em “Salvar como PDF” (ou Ctrl+P). A geração automática em PDF e o envio por e-mail/WhatsApp entram com os fluxos n8n.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>O que vai no laudo</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2 text-texto-suave">
            <p>1. Capa com organização, fazenda, período e data de emissão.</p>
            <p>2. Resumo: armadilhas ativas, vistorias, adultos (total, média, máximo), septos vencidos.</p>
            <p>3. Mapa de calor com os talhões.</p>
            <p>4. Tabela por talhão: armadilhas, vistorias, adultos, média, nível de infestação.</p>
            <p>5. Evolução semanal das capturas.</p>
            <p>6. Armadilhas com septo vencido ou a vencer.</p>
            <p>7. Galeria de fotos georreferenciadas (auditoria).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
