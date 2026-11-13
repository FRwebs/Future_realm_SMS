/** The quotation under the phone sign-in. The wide screen shows the same words in its left panel. */
export function LoginQuote() {
  return (
    <figure className="relative mt-[22px] overflow-hidden rounded-[20px] bg-white p-4 md:hidden" style={{ boxShadow: "0 1px 2px rgba(13,35,21,0.05), 0 8px 22px -14px rgba(13,35,21,0.18)" }}>
      <div aria-hidden="true" className="h-[14px] text-[30px] font-black leading-[0.6] text-[#bfdccd]">&ldquo;</div>
      <blockquote className="text-[13px] italic leading-[1.6] text-[#435048] text-pretty">
        Knowledge is power. Information is liberating. Education is the premise of progress, in every society, in every family.
      </blockquote>
      <figcaption className="mt-3 flex items-center gap-[10px]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d2315] text-[11px] font-extrabold text-white">KA</span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-extrabold text-[#0d2315]">Kofi Annan</span>
          <span className="block text-[11.5px] text-[#5c6a62]">Secretary-General of the United Nations, 1997–2006</span>
        </span>
      </figcaption>
    </figure>
  );
}
