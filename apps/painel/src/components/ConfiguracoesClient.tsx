"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ROTULO_PAPEL, dataHora } from "@/lib/formatar";

export interface Organizacao {
  id: string; nome: string; tipo: string; plano: string;
  dias_septo: number; dias_septo_aviso: number; espacamento_malha_m: number; faixa_media_min: number; faixa_alta_min: number;
}
export interface Usuario { id: string; nome: string; email: string; telefone: string | null; papel: string; ativo: boolean; criado_em: string }

export function ConfiguracoesClient({ org, usuarios, podeGerir, meuId }: { org: Organizacao; usuarios: Usuario[]; podeGerir: boolean; meuId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);

  async function salvarParametros(fd: FormData) {
    setOcupado(true);
    const res = await fetch("/api/configuracoes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: fd.get("nome"),
        dias_septo: Number(fd.get("dias_septo")), dias_septo_aviso: Number(fd.get("dias_septo_aviso")),
        espacamento_malha_m: Number(fd.get("espacamento_malha_m")),
        faixa_media_min: Number(fd.get("faixa_media_min")), faixa_alta_min: Number(fd.get("faixa_alta_min")),
      }),
    });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao salvar"); return; }
    toast.success("Parâmetros salvos — valem para o app na próxima sincronização");
    router.refresh();
  }

  async function criarUsuario(fd: FormData) {
    setOcupado(true);
    const res = await fetch("/api/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: fd.get("nome"), email: fd.get("email"), telefone: fd.get("telefone") || undefined, papel: fd.get("papel"), senha: fd.get("senha") }),
    });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro ao criar usuário"); return; }
    toast.success("Usuário criado — já pode entrar no app de campo");
    setNovo(false);
    router.refresh();
  }

  async function alternarAtivo(u: Usuario) {
    const res = await fetch("/api/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, ativo: !u.ativo }) });
    if (!res.ok) { toast.error((await res.json()).erro || "Erro"); return; }
    router.refresh();
  }

  async function trocarSenha(fd: FormData) {
    if (!senhaDe) return;
    setOcupado(true);
    const res = await fetch("/api/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: senhaDe.id, senha: fd.get("senha") }) });
    setOcupado(false);
    if (!res.ok) { toast.error((await res.json()).erro || "Erro"); return; }
    toast.success(`Senha de ${senhaDe.nome} redefinida`);
    setSenhaDe(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-texto-suave mt-1">{org.nome} · plano <Badge variant="outline" className="align-middle capitalize">{org.plano}</Badge></p>
      </header>

      <Tabs defaultValue="parametros">
        <TabsList>
          <TabsTrigger value="parametros">Parâmetros agronômicos</TabsTrigger>
          {podeGerir && <TabsTrigger value="usuarios">Usuários ({usuarios.length})</TabsTrigger>}
          <TabsTrigger value="app">App de campo</TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Protocolo da organização</CardTitle>
              <CardDescription>Cada usina segue o próprio protocolo. Estes valores definem os alertas do app, as cores do mapa e a malha padrão.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={salvarParametros} className="grid gap-4">
                <div className="grid gap-1.5"><Label htmlFor="nome">Nome da organização</Label><Input id="nome" name="nome" defaultValue={org.nome} disabled={!podeGerir} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5"><Label htmlFor="dias_septo">Vida útil do septo (dias)</Label><Input id="dias_septo" name="dias_septo" type="number" min={7} max={120} defaultValue={org.dias_septo} disabled={!podeGerir} /><p className="text-xs text-texto-suave">Alerta crítico ao atingir este valor.</p></div>
                  <div className="grid gap-1.5"><Label htmlFor="dias_septo_aviso">Aviso de troca (dias)</Label><Input id="dias_septo_aviso" name="dias_septo_aviso" type="number" min={1} max={119} defaultValue={org.dias_septo_aviso} disabled={!podeGerir} /><p className="text-xs text-texto-suave">Badge amarelo a partir deste dia.</p></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-1.5"><Label htmlFor="esp">Malha padrão (m)</Label><Input id="esp" name="espacamento_malha_m" type="number" min={5} max={500} defaultValue={org.espacamento_malha_m} disabled={!podeGerir} /></div>
                  <div className="grid gap-1.5"><Label htmlFor="fm">Infestação média a partir de</Label><Input id="fm" name="faixa_media_min" type="number" min={1} defaultValue={org.faixa_media_min} disabled={!podeGerir} /></div>
                  <div className="grid gap-1.5"><Label htmlFor="fa">Infestação alta a partir de</Label><Input id="fa" name="faixa_alta_min" type="number" min={2} defaultValue={org.faixa_alta_min} disabled={!podeGerir} /></div>
                </div>
                <p className="text-xs text-texto-suave">Faixas em adultos por armadilha na última vistoria. Referência bp bioenergy: 30 m de espaçamento foi o mais eficiente; septo de 30 dias.</p>
                {podeGerir && <div><Button type="submit" disabled={ocupado}>Salvar parâmetros</Button></div>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {podeGerir && (
          <TabsContent value="usuarios" className="mt-4 space-y-4">
            <div className="flex justify-end"><Button onClick={() => setNovo(true)}><UserPlus /> Novo usuário</Button></div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead>Criado</TableHead><TableHead>Ativo</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {usuarios.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.nome}{u.id === meuId && <span className="text-xs text-texto-suave"> (você)</span>}</TableCell>
                        <TableCell className="text-texto-suave">{u.email}</TableCell>
                        <TableCell>{ROTULO_PAPEL[u.papel] ?? u.papel}</TableCell>
                        <TableCell className="text-texto-suave">{dataHora(u.criado_em)}</TableCell>
                        <TableCell><Switch checked={u.ativo} disabled={u.id === meuId} onCheckedChange={() => alternarAtivo(u)} /></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setSenhaDe(u)}><KeyRound /> Senha</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="app" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Aplicativo de campo</CardTitle><CardDescription>Android primeiro; iPhone pelo mesmo código quando necessário.</CardDescription></CardHeader>
            <CardContent className="text-sm space-y-3">
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Crie o usuário do pragueiro na aba <strong>Usuários</strong> (papel "Pragueiro").</li>
                <li>Instale o APK no celular de campo (link de distribuição enviado pela Avila Ops).</li>
                <li>No primeiro acesso, entre com e-mail e senha <em>com internet</em>; depois o app funciona offline o dia todo.</li>
                <li>Baixe o mapa offline da fazenda pelo Wi-Fi da sede antes de ir a campo.</li>
                <li>Ao voltar ao sinal, toque em <strong>Sincronizar</strong> — as vistorias e fotos sobem e os pontos planejados descem.</li>
              </ol>
              <p className="text-xs text-texto-suave">Servidor: <code>https://migdolus.avilaops.com/api</code></p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <form action={criarUsuario}>
            <DialogHeader><DialogTitle>Novo usuário</DialogTitle><DialogDescription>Pragueiro usa o app; agrônomo e gestor usam o painel.</DialogDescription></DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5"><Label htmlFor="unome">Nome</Label><Input id="unome" name="nome" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label htmlFor="uemail">E-mail</Label><Input id="uemail" name="email" type="email" required /></div>
                <div className="grid gap-1.5"><Label htmlFor="utel">WhatsApp</Label><Input id="utel" name="telefone" placeholder="+55 16 9…" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Papel</Label>
                  <Select name="papel" defaultValue="pragueiro">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pragueiro">Pragueiro</SelectItem>
                      <SelectItem value="agronomo">Agrônomo</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label htmlFor="usenha">Senha inicial</Label><Input id="usenha" name="senha" type="text" minLength={8} required /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!senhaDe} onOpenChange={(o) => !o && setSenhaDe(null)}>
        <DialogContent>
          <form action={trocarSenha}>
            <DialogHeader><DialogTitle>Redefinir senha</DialogTitle><DialogDescription>{senhaDe?.nome} · {senhaDe?.email}</DialogDescription></DialogHeader>
            <div className="grid gap-1.5 py-4"><Label htmlFor="nsenha">Nova senha</Label><Input id="nsenha" name="senha" type="text" minLength={8} required /></div>
            <DialogFooter><Button type="submit" disabled={ocupado}>Salvar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
