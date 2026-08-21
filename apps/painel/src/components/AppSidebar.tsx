"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Flame, MapPin, Map as MapIcon, Settings2, LogOut, TrendingDown, FileText } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ROTULO_PAPEL } from "@/lib/formatar";

const ITENS = [
  { href: "/", rotulo: "Visão geral", Icone: LayoutDashboard },
  { href: "/mapa", rotulo: "Mapa de calor", Icone: Flame },
  { href: "/armadilhas", rotulo: "Armadilhas", Icone: MapPin },
  { href: "/talhoes", rotulo: "Fazendas e talhões", Icone: MapIcon },
  { href: "/safras", rotulo: "Safras e resultados", Icone: TrendingDown },
  { href: "/relatorios", rotulo: "Relatórios", Icone: FileText },
];

export function AppSidebar({ nome, papel }: { nome: string; papel: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3 px-1">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marca text-white">
            <MapPin size={18} />
          </span>
          <span className="font-semibold text-white tracking-tight group-data-[collapsible=icon]:hidden">Migdolus Monitor</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITENS.map(({ href, rotulo, Icone }) => {
                const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton render={<Link href={href} />} isActive={ativo} tooltip={rotulo}>
                      <Icone /><span>{rotulo}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/configuracoes" />} isActive={pathname.startsWith("/configuracoes")} tooltip="Configurações">
                  <Settings2 /><span>Configurações</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-medium text-white truncate">{nome}</p>
          <p className="text-xs text-sidebar-foreground/70">{ROTULO_PAPEL[papel] ?? papel}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={sair} tooltip="Sair"><LogOut /><span>Sair</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
