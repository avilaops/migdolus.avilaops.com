import * as Location from "expo-location";
import { ESPERA_GPS_MS, PRECISAO_ALVO_M } from "./config";

export interface Posicao {
  lat: number;
  lon: number;
  precisao_m: number | null;
  precisao_baixa: boolean;
  capturada_em: string;
}

export async function pedirPermissao(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

/**
 * Aguarda uma leitura com precisão <= alvo por até `esperaMs`; senão devolve a
 * melhor leitura obtida marcada como precisao_baixa. Funciona sem rede (GPS puro).
 */
export async function capturarPosicao(
  onLeitura?: (p: Posicao) => void,
  alvoM = PRECISAO_ALVO_M,
  esperaMs = ESPERA_GPS_MS,
): Promise<Posicao> {
  const ok = await pedirPermissao();
  if (!ok) throw new Error("Permissão de localização negada");

  return new Promise<Posicao>((resolve, reject) => {
    let melhor: Posicao | null = null;
    let sub: Location.LocationSubscription | null = null;
    let terminado = false;

    const finalizar = (p: Posicao | null) => {
      if (terminado) return;
      terminado = true;
      sub?.remove();
      clearTimeout(timer);
      if (p) resolve(p);
      else reject(new Error("GPS sem leitura — vá para céu aberto e tente de novo"));
    };

    const timer = setTimeout(() => finalizar(melhor ? { ...melhor, precisao_baixa: (melhor.precisao_m ?? 999) > alvoM } : null), esperaMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        const p: Posicao = {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          precisao_m: loc.coords.accuracy ?? null,
          precisao_baixa: false,
          capturada_em: new Date(loc.timestamp).toISOString(),
        };
        if (!melhor || (p.precisao_m ?? 999) < (melhor.precisao_m ?? 999)) melhor = p;
        onLeitura?.(melhor);
        if ((p.precisao_m ?? 999) <= alvoM) finalizar(p);
      },
    ).then((s) => { sub = s; if (terminado) s.remove(); }).catch((e) => { clearTimeout(timer); reject(e); });
  });
}

/** Distância em metros (haversine). */
export function distanciaM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Rumo em graus (0 = norte) de A para B. */
export function rumoGraus(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const φ1 = (aLat * Math.PI) / 180, φ2 = (bLat * Math.PI) / 180, Δλ = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function formatarDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
