import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  return (
    <SidebarProvider>
      <AppSidebar nome={sessao.nome} papel={sessao.papel} />
      <SidebarInset className="bg-fundo">
        <header className="flex h-12 items-center gap-2 border-b border-borda bg-superficie px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium">Migdolus Monitor</span>
        </header>
        <main className="flex-1 min-w-0 p-5 lg:p-8">{children}</main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
