import { NextResponse } from "next/server";

// Estilo MapLibre (satélite Esri) usado pelo app de campo — online e como base
// do pacote offline por fazenda. Público: não tem dado da organização.
export async function GET() {
  return NextResponse.json(
    {
      version: 8,
      name: "Migdolus Satélite",
      sources: {
        satelite: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [{ id: "satelite", type: "raster", source: "satelite" }],
    },
    { headers: { "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" } },
  );
}
