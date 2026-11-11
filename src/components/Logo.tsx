import { BRAND } from "@/lib/brand";

/** Brand lockup: the CLIP tile and the name. `slim` (navbar once you scroll) leaves only the C, see-through. */
export function Logo({ size = 28, slim = false }: { size?: number; slim?: boolean }) {
  const s = size * 1.45;
  return (
    <span className={`logo inline-flex items-center ${slim ? "slim" : ""}`}>
      <span className="relative inline-block" style={{ width: s, height: s }}>
        <img src="/brand/pfp-512.png" alt="" width={s} height={s} className="logo-tile absolute inset-0 rounded-[10px]" style={{ filter: "drop-shadow(0 0 10px rgba(255,61,139,.6))" }} />
        <span aria-hidden className="logo-c absolute inset-0" />
      </span>
    </span>
  );
}
