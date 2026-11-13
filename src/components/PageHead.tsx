/** Title block shared by the standalone pages: script kicker, sunset headline, one line of context. */
export function PageHead({ script, title, sub, bg }: { script: string; title: string; sub: string; bg?: string }) {
  return (
    <header className="page-head" style={bg ? ({ "--bg": `url(${bg})` } as React.CSSProperties) : undefined}>
      <p className="script">{script}</p>
      <h1 className="live-title">{title}</h1>
      <p className="mt-2 max-w-[720px] text-[17px] leading-[1.55] text-haze">{sub}</p>
    </header>
  );
}
