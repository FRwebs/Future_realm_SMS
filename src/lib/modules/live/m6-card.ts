import { apiGet, observe } from "@/lib/api/server";
import { localContracts } from "@/lib/api/local-contracts.zod";
import { cardPaper, documentUrl } from "@/lib/modules/live/documents";
import { loadCompletionArm } from "@/lib/modules/live/m6-completion";
import { publishDrawer, RC, releaseDrawer, sendDrawer, withholdDrawer } from "@/lib/modules/live/m6-forms";
import type { CardView } from "@/lib/modules/live/m6-types";
import type { DocAct, DocumentSpec } from "@/lib/modules/panels";

/** One report card: the document exactly as the family sees it, and what can be done with it. */

export const loadCard = (studentId: string, termId?: string) => apiGet(`${RC}/card/${encodeURIComponent(studentId)}${termId ? `?term=${encodeURIComponent(termId)}` : ""}`, observe<CardView>(localContracts["src/lib/modules/live/m6-card.ts#25d3d20a"]));
export const loadPrintSet = (query: URLSearchParams) => apiGet(`${RC}/print?${query.toString()}`, observe<{ term: { id: string; name: string; session: string }; cards: CardView[]; count: number; drafts: number }>(localContracts["src/lib/modules/live/m6-card.ts#ca250152"]));

const shortName = (name: string) => name.split(" ").slice(0, 2).map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(" ");

/**
 * The card in its modal: the paper, the rest of the arm to walk through, and the one decision that
 * fits where the card stands — publish it, send it again, or release it.
 */
export async function cardDocument(view: CardView): Promise<DocumentSpec> {
  const card = view.card;
  const arm = await loadCompletionArm(card.classId).catch(() => null);
  const term = `${view.term.name} ${view.term.session}`;
  const out = view.state === "Published" || view.state === "Revised";
  const scope = { students: [card.studentId] };
  const publish = publishDrawer({ label: card.studentName, ready: 1, total: 1, scope, reversibleMinutes: arm?.policy.reversibleMinutes ?? 60, withholdForDebt: arm?.policy.withholdForDebt ?? false, term });
  const send = sendDrawer({ label: card.studentName, ready: out ? 1 : 0, total: 1, scope, school: view.school.name, term: view.term.name });
  const primary: DocAct = out
    ? { label: "Send to the guardian again", drawer: send, primary: true }
    : view.state === "Withheld"
      ? { label: "Release this card", drawer: releaseDrawer({ id: card.studentId, name: card.studentName }), primary: true }
      : { label: "Publish to the guardian portal", drawer: publish, primary: true };
  const mine = arm?.children.find((child) => child.id === card.studentId);
  return {
    ...cardPaper(view),
    note: out
      ? "Published to the guardian portal. Any correction reissues the card and notifies the family."
      : view.state === "Withheld"
        ? `Withheld${view.withheldReason ? ` — ${view.withheldReason}` : ""}. It is skipped by every publish until released.`
        : mine?.blockedBy.length
          ? `Not published. Waiting on ${mine.blockedBy.join(", ")}.`
          : "Not published. Nothing has reached the family yet.",
    peers: { label: `Others in ${card.arm}`, items: view.peers.slice(0, 12).map((peer) => ({ label: shortName(peer.name), load: documentUrl("card", peer.id, { term: view.term.id }), active: peer.id === card.studentId })) },
    acts: [
      { label: "Open the full record", href: `/student-records/registry/${card.studentId}` },
      { label: "Print", print: true },
      ...(view.state === "Draft" ? [{ label: "Withhold this card", drawer: withholdDrawer({ id: card.studentId, name: card.studentName }, card.arm) }] : []),
      primary,
    ],
  };
}
