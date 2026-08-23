import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verificarToken } from "@/lib/auth";

// Protege as páginas do painel. As rotas /api cuidam da própria autenticação
// (aceitam Bearer do app de campo), por isso ficam fora do matcher.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const sessao = token ? await verificarToken(token) : null;

  if (pathname === "/entrar") {
    if (sessao) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (!sessao) {
    const url = new URL("/entrar", req.url);
    if (pathname !== "/") url.searchParams.set("voltar", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|.*\\.(?:png|svg|jpg|webp|ico)$).*)"],
};
