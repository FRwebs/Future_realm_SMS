import { ImageResponse } from "next/og";

const SIZES = new Set(["192", "512"]);

/** The app icon, drawn rather than shipped as a file: the brand's ink green with the two-letter mark. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const edge = Number(size);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d2315", color: "#5fd6b4", fontSize: edge * 0.42, fontWeight: 800, letterSpacing: -edge * 0.02 }}>
        FR
      </div>
    ),
    { width: edge, height: edge },
  );
}
