/**
 * GTA VI key-art backdrop: violet → magenta → orange sunset, low sun, and dark palm silhouettes drawn in SVG
 * (trunk + fronds), the way the official artwork frames Leonida.
 */
function Palm({ x, y, s, flip = false, lean = 0 }: { x: number; y: number; s: number; flip?: boolean; lean?: number }) {
  const fronds = Array.from({ length: 9 }, (_, i) => {
    const a = -170 + i * 20 + (i % 2 ? 6 : -4);
    const L = 150 + (i % 3) * 22;
    return <path key={i} d={`M0 0 C ${L * 0.25} ${-L * 0.35}, ${L * 0.6} ${-L * 0.5}, ${L} ${-L * 0.42} C ${L * 0.65} ${-L * 0.28}, ${L * 0.35} ${-L * 0.1}, 0 0 Z`} transform={`rotate(${a})`} />;
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) rotate(${lean})`} fill="#160a2e">
      <path d="M-9 0 C -14 -120, 4 -240, 2 -360 L 14 -360 C 22 -240, 8 -120, 11 0 Z" />
      <g transform="translate(8 -358)">{fronds}<circle r="14" /></g>
    </g>
  );
}

export function PalmBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "linear-gradient(178deg, #2b0f55 0%, #6a1d8f 34%, #d6298b 62%, #ff8c46 88%, #ffc46b 100%)" }} />
      <div className="absolute left-1/2 top-[62%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,230,150,.95), rgba(255,150,80,.6) 42%, transparent 70%)", filter: "blur(4px)" }} />
      <div className="absolute inset-x-0 top-[66%] h-px bg-white/25" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax slice">
        <Palm x={48} y={520} s={0.72} lean={-8} />
        <Palm x={372} y={525} s={0.86} flip lean={6} />
        <Palm x={330} y={540} s={0.5} flip lean={-14} />
        <rect x="0" y="470" width="400" height="40" fill="#160a2e" />
      </svg>
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.05) 3px 4px)" }} />
    </div>
  );
}
