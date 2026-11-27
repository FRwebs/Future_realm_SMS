/**
 * An agreement's words as numbered clauses, so a school reads them one at a time. A heading line followed by its words — "6. Sub-processors"
 * then the paragraph — is one clause; text that does not follow that pattern is kept whole rather than guessed at.
 */
export function agreementBlocks(body: string): Array<{ label: string; body: string }> {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [first, ...rest] = chunk.split("\n");
      return /^\d+\.\s/.test(first!) && rest.length ? { label: first!, body: rest.join(" ") } : { label: "", body: chunk.replace(/\n/g, " ") };
    })
    .filter((block) => block.body && !/^DATA PROCESSING AGREEMENT$/i.test(block.body));
}
