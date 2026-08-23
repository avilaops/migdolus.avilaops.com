import { ImageResponse } from "next/og";

// Imagem de compartilhamento (WhatsApp/redes): 1200×630, gerada no servidor.
export const runtime = "nodejs";
export const alt = "Migdolus Monitor — monitoramento georreferenciado da broca-gigante da cana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0f1f17 0%, #14301f 55%, #1f7a3e 130%)",
          color: "#fff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* pontos do "mapa de calor" ao fundo */}
        {[
          [880, 90, 26, "#2e9e52"], [960, 150, 20, "#2e9e52"], [1040, 110, 30, "#e0b400"],
          [920, 230, 24, "#e0b400"], [1010, 300, 34, "#d32f2f"], [1090, 220, 22, "#d32f2f"],
          [860, 330, 18, "#2e9e52"], [1100, 370, 26, "#e0b400"], [960, 400, 20, "#2e9e52"],
        ].map(([x, y, r, cor], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Number(x),
              top: Number(y),
              width: Number(r) * 2,
              height: Number(r) * 2,
              borderRadius: 999,
              background: String(cor),
              opacity: 0.85,
              border: "3px solid rgba(255,255,255,0.85)",
              display: "flex",
            }}
          />
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#1f7a3e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            📍
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 700 }}>Migdolus Monitor</div>
            <div style={{ fontSize: 22, color: "#c8d6cd" }}>migdolus.avilaops.com · Avila Ops</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>
            Do caderno de campo ao mapa de calor, no mesmo dia.
          </div>
          <div style={{ fontSize: 27, color: "#d8e4dc", lineHeight: 1.4 }}>
            Armadilhas de Migdolus georreferenciadas por GPS, troca de septo nunca esquecida e laudo com fotos auditáveis para a usina.
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, fontSize: 24, color: "#e3f3e8" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#fff" }}>−94%</div>
            <div>capturas em 3 safras</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#fff" }}>30 m</div>
            <div>malha mais eficiente</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#fff" }}>+96%</div>
            <div>TCH vs. sem controle</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
