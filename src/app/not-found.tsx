import Link from "next/link";
export default function NotFound() {
  return (
    <div className="enter mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <div aria-hidden className="dither sprockets mb-8 grid size-40 place-items-center border-2 border-line font-sign text-5xl text-sun shadow-[6px_6px_0_var(--color-pink)]">404</div>
      <h1 className="font-sign text-3xl sm:text-4xl">Nobody here</h1>
      <p className="mt-3 text-haze">This link went nowhere. The coin may not exist, or the URL has a typo.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-hot">Browse coins</Link>
        <Link href="/map" className="btn btn-ghost">Back to the map</Link>
      </div>
    </div>
  );
}
