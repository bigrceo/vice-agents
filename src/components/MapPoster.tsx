/** Still of the map as it first appears, shown from the very first paint so the page never looks like it is loading.
 *  The live 3D map fades in over it once its ground is ready. */
export function MapPoster({ hidden = false }: { hidden?: boolean }) {
  return (
    <picture aria-hidden className={`pointer-events-none absolute inset-0 block transition-opacity duration-700 ${hidden ? "opacity-0" : "opacity-100"}`}>
      <source media="(max-width: 767px)" srcSet="/map/poster-mobile.webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/map/poster-desktop.webp" alt="" fetchPriority="high" decoding="async" className="size-full object-cover" />
    </picture>
  );
}
