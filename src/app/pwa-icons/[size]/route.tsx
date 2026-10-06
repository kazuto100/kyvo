import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 512;
  const unit = size / 64;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111215",
          position: "relative",
        }}
      >
        <div style={{ color: "white", fontSize: 38 * unit, fontWeight: 800, letterSpacing: -2 * unit }}>R</div>
        <div
          style={{
            position: "absolute",
            top: 15 * unit,
            right: 15 * unit,
            width: 8 * unit,
            height: 8 * unit,
            borderRadius: 999,
            background: "#34c77b",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
