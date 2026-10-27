import type { DocCell, DocumentSpec } from "@/lib/modules/panels";
import { toneOf } from "@/lib/modules/tones";

const cellOf = (cell: DocCell) => (typeof cell === "string" ? { text: cell } : cell);

/**
 * The paper: letterhead, who and what, the table, the totals, the remarks and the footing.
 *
 * It draws a `DocumentSpec` and nothing else, so the modal that previews a document and the page that
 * prints it can never disagree about what is on it. Server-safe — no state, no hooks.
 */
export function DocumentPaper({ doc, className = "" }: { doc: DocumentSpec; className?: string }) {
  const stamp = doc.stamp ? toneOf(doc.stamp.tone) : null;
  return (
    <section data-print-grid="true" className={`relative break-inside-avoid overflow-hidden rounded-[12px] border border-[#DEE8E2] bg-white px-[26px] py-[24px] text-[#0D2315] print:rounded-none print:border-0 print:px-6 print:py-6 ${className}`}>
      <header className="flex items-start justify-between gap-[18px] border-b-2 border-[#0D2315] pb-[14px]">
        <div className="min-w-0">
          <h1 className="font-(family-name:--font-heading) text-[17px] font-extrabold leading-[1.2] tracking-[-0.01em]">{doc.letterhead.name}</h1>
          {doc.letterhead.place ? <p className="mt-[3px] text-[10.5px] leading-normal text-[#5F6E65]">{doc.letterhead.place}</p> : null}
          {doc.letterhead.contact ? <p className="text-[10.5px] leading-normal text-[#5F6E65]">{doc.letterhead.contact}</p> : null}
        </div>
        <div className="flex-none text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5f6e65]">{doc.kicker}</p>
          <p className="mt-[3px] font-(family-name:--font-heading) text-[12.5px] font-bold leading-[1.3] text-[#12796A]">{doc.title}</p>
          {doc.ref ? <p className="mt-[2px] text-[10px] text-[#5f6e65]">{doc.ref}</p> : null}
          {doc.stamp && stamp ? (
            <p className="mt-[8px] inline-block rotate-[-5deg] rounded-[7px] border-2 px-[10px] py-[2px] text-[13px] font-extrabold tracking-[0.18em]" style={{ color: stamp.fg, borderColor: stamp.fg }}>
              {doc.stamp.text}
            </p>
          ) : null}
        </div>
      </header>

      {doc.idents.length ? (
        <dl className="grid grid-cols-2 gap-[11px] border-b border-[#EDF3EF] py-[14px] sm:grid-cols-4">
          {doc.idents.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#5f6e65]">{label}</dt>
              <dd className="mt-[3px] text-pretty text-[11.5px] font-semibold leading-[1.4]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {(doc.tables ?? []).map((table, index) => (
        <div key={table.title ?? index} className="mt-[16px] overflow-x-auto rounded-[9px] border border-[#E6EEE9]">
          <table className="w-full min-w-[460px] border-collapse text-[10.5px]">
            <thead className="bg-[#F7FAF8]">
              <tr>
                {table.heads.map((head, i) => (
                  <th key={`${head.label}-${i}`} className="px-[11px] py-[8px] text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#5f6e65]" style={{ textAlign: head.align ?? (i === 0 ? "left" : "right") }}>
                    {head.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r} className={r % 2 ? "bg-[#FBFDFC]" : ""}>
                  {row.map((raw, c) => {
                    const cell = cellOf(raw);
                    const head = table.heads[c];
                    return (
                      <td key={c} className={`border-t border-[#F4F8F6] px-[11px] py-[7px] leading-[1.4] ${cell.mono ? "font-mono" : ""}`} style={{ textAlign: head?.align ?? (c === 0 ? "left" : "right"), fontWeight: cell.bold || c === 0 ? 600 : 400, color: cell.tone ? toneOf(cell.tone).fg : c === 0 ? "#0D2315" : "#435048", fontVariantNumeric: "tabular-nums" }}>
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {doc.summary?.length ? (
        <div className="ml-auto mt-[14px] grid w-full max-w-[280px] gap-[4px] text-[11.5px]">
          {doc.summary.map((line) => (
            <p key={line.label} className={`flex justify-between gap-4 ${line.strong ? "border-t border-[#0D2315] pt-[4px] text-[13px] font-bold" : ""}`}>
              <span className={line.strong ? "" : "text-[#5f6e65]"}>{line.label}</span>
              <span className="font-mono">{line.value}</span>
            </p>
          ))}
        </div>
      ) : null}

      {doc.totals?.length ? (
        <div className="mt-[14px] grid grid-cols-2 gap-[9px] sm:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]">
          {doc.totals.map((box) => {
            const tone = box.tone && box.tone !== "neutral" ? toneOf(box.tone) : null;
            return (
              <div key={box.label} className="min-w-0 rounded-[9px] border px-[12px] py-[10px]" style={{ borderColor: tone?.bd ?? "#E6EEE9", background: tone?.bg ?? "#FBFDFC" }}>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#5f6e65]">{box.label}</p>
                <p className="mt-[4px] font-(family-name:--font-heading) text-[16px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{box.value}</p>
                {box.sub ? <p className="mt-[2px] text-[9.5px] leading-[1.4] text-[#5f6e65]">{box.sub}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {doc.groups?.length ? (
        <div className="mt-[16px] grid gap-[14px] sm:grid-cols-2">
          {doc.groups.map((group) => (
            <div key={group.title} className="min-w-0 overflow-hidden rounded-[9px] border border-[#E6EEE9]">
              <p className="border-b border-[#EDF3EF] bg-[#F7FAF8] px-[11px] py-[7px] text-[9px] font-bold uppercase tracking-[0.07em] text-[#5F6E65]">{group.title}</p>
              {group.items.map(([label, value]) => (
                <p key={label} className="flex items-center justify-between gap-[10px] border-b border-[#F4F8F6] px-[11px] py-[6.5px] text-[10.5px] last:border-b-0">
                  <span className="min-w-0 text-[#435048]">{label}</span>
                  <span className="flex-none font-bold tracking-[0.06em]">{value}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {doc.blocks?.length ? (
        <div className="mt-[16px] grid gap-[10px]">
          {doc.blocks.map((block) => (
            <div key={block.label} className="rounded-[9px] border border-[#E6EEE9] bg-[#FBFDFC] px-[13px] py-[12px]">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#5f6e65]">{block.label}</p>
              <p className="mt-[5px] text-pretty text-[11.5px] leading-[1.6]">{block.body}</p>
              {block.by ? <p className="mt-[6px] text-[9.5px] text-[#5f6e65]">{block.by}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {doc.list ? (
        <section className="mt-[16px]">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.07em] text-[#5f6e65]">{doc.list.title}</p>
          {doc.list.items.length ? (
            <ul className="mt-[8px] grid gap-[4px] text-[11px]">
              {doc.list.items.map((item, index) => (
                <li key={`${item.left}-${index}`} className="flex justify-between gap-3 rounded-[8px] border border-[#E6EEE9] px-3 py-[6px]">
                  <span>{item.left}</span>
                  <span className="font-mono">{item.right}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[8px] text-[11px] text-[#5f6e65]">{doc.list.empty}</p>
          )}
        </section>
      ) : null}

      {doc.footNote || doc.footRef ? (
        <footer className="mt-[20px] flex flex-wrap items-end justify-between gap-4 border-t border-[#EDF3EF] pt-[14px]">
          <p className="max-w-[380px] text-pretty text-[9.5px] leading-[1.55] text-[#5f6e65]">{doc.footNote}</p>
          <p className="whitespace-pre-line text-right text-[9.5px] text-[#5f6e65]">{doc.footRef}</p>
        </footer>
      ) : null}
    </section>
  );
}
