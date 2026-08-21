import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Device from "expo-device";
import { limparTokens, login as loginApi, temSessao, type Usuario } from "./api";
import { gravarConfig, lerConfig, limparTudo, uuid } from "./db";

interface Sessao {
  pronto: boolean;
  logado: boolean;
  usuario: Usuario | null;
  deviceId: string;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    (async () => {
      let id = await lerConfig("device_id");
      if (!id) {
        id = `${(Device.modelName ?? "android").replace(/\s+/g, "-").toLowerCase()}-${uuid().slice(0, 8)}`;
        await gravarConfig("device_id", id);
      }
      setDeviceId(id);
      const u = await lerConfig("usuario");
      if (u) setUsuario(JSON.parse(u));
      setLogado(await temSessao());
      setPronto(true);
    })();
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await loginApi(email, senha, deviceId);
    await gravarConfig("usuario", JSON.stringify(r.usuario));
    if (r.organizacao) await gravarConfig("parametros", JSON.stringify(r.organizacao));
    setUsuario(r.usuario);
    setLogado(true);
  }, [deviceId]);

  const sair = useCallback(async () => {
    await limparTokens();
    await limparTudo();
    await gravarConfig("device_id", deviceId);
    setUsuario(null);
    setLogado(false);
  }, [deviceId]);

  const valor = useMemo(() => ({ pronto, logado, usuario, deviceId, entrar, sair }), [pronto, logado, usuario, deviceId, entrar, sair]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSessao fora do SessaoProvider");
  return s;
}
