import Constants from "expo-constants";

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://migdolus.avilaops.com/api";

// Estilo do mapa (satélite) servido pelo painel — o mesmo URL é usado pelo pacote offline.
export const ESTILO_MAPA_URL = `${API_URL}/mapa/estilo`;

export const CORES = {
  marca: "#1f7a3e",
  marcaEscura: "#155a2d",
  marcaClara: "#e3f3e8",
  fundo: "#f4f6f3",
  superficie: "#ffffff",
  texto: "#14201a",
  textoSuave: "#5b6b62",
  borda: "#dfe5e0",
  ok: "#1f7a3e",
  aviso: "#d9a400",
  critico: "#c62828",
  lateral: "#0f1f17",
};

export const PRECISAO_ALVO_M = 10;
export const ESPERA_GPS_MS = 15_000;
export const DISTANCIA_REALOCACAO_M = 30;
