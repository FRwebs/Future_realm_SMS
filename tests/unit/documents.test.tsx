import { renderToStaticMarkup } from "react-dom/server";

import { DocumentPaper } from "@/components/modules/document-paper";
import { documentDrawer, invoicePaper, receiptPaper, structurePaper } from "@/lib/modules/live/documents";
import type { ReceiptDoc, StructureDetail } from "@/lib/modules/live/m10-types";
import type { InvoiceDoc } from "@/lib/modules/live/m11-types";

const receipt: ReceiptDoc = {
  id: "p-1", ref: "RCT-2026-001", issued: null, payer: "Mrs Yusuf", student: "Daniel Yusuf", adm: "GFC/25/0001", arm: "Nursery 2 A", mode: "Transfer", bankRef: "GTB/1", date: "2026-09-15", by: "Tunde", paid: 60000, billed: 100000, paidToDate: 60000, balance: 40000,
  receipts: 1, term: "Second Term", invoice: "INV-1", items: [{ label: "Tuition", billed: 100000, previously: 0, applied: 60000, balance: 40000 }], school: { name: "Greenfield", address: "Ibadan", phone: "0803", email: "a@b.ng" }, ageing: "30-day bucket", daysOld: 12,
};

describe("A document", () => {
  it("opens in a modal that is read from where its paper is kept, not on a page of its own", () => {
    const trigger = documentDrawer("receipt", "p-1", { title: "Receipt RCT-2026-001", query: { duplicate: "1" } });
    expect(trigger).toMatchObject({ mode: "document", load: "/documents/receipt/p-1?duplicate=1" });
  });

  it("stamps a reprint DUPLICATE on the paper itself, and an original not at all", () => {
    expect(renderToStaticMarkup(<DocumentPaper doc={receiptPaper(receipt, true)} />)).toContain("DUPLICATE");
    expect(renderToStaticMarkup(<DocumentPaper doc={receiptPaper(receipt, false)} />)).not.toContain("DUPLICATE RECEIPT");
  });

  it("says what is still owed on a receipt, and settles it when nothing is", () => {
    expect(receiptPaper(receipt, false).note).toBe("₦40,000 still outstanding on this account.");
    expect(receiptPaper({ ...receipt, balance: 0 }, false).note).toBe("This account is settled in full.");
  });

  it("draws a fee schedule's lines by how often they are charged", () => {
    const structure = { id: "s-1", ref: "FS-1", name: "Junior", state: "Draft", classes: ["JSS 1"], termLabel: "Second Term", termly: 185000, termlyAll: 200000, sessional: 20000, rules: [], items: [{ id: "i1", name: "Tuition", type: "Mandatory", freq: "Termly", amount: 185000 }, { id: "i2", name: "Levy", type: "Mandatory", freq: "Sessional", amount: 20000 }] } as unknown as StructureDetail;
    const doc = structurePaper(structure, { name: "Greenfield" });
    expect(doc.tables?.map((table) => table.title)).toEqual(["Termly", "Sessional"]);
    expect(doc.stamp?.text).toBe("DRAFT");
  });

  it("stamps an unpaid invoice UNPAID and offers to pay it", () => {
    const invoice = { id: "v1", no: "INV-9", kind: "TERMLY", state: "Outstanding", issued: "2026-09-01", due: "2026-09-30", paidAt: null, currency: "NGN", lines: [], subtotal: 100, tax: 7.5, total: 107.5, paid: 0, billTo: { name: "Greenfield", address: "", attention: "", email: "" }, payments: [] } as InvoiceDoc;
    const doc = invoicePaper(invoice);
    expect(doc.stamp?.text).toBe("UNPAID");
    expect(doc.acts?.map((act) => act.label)).toContain("Pay from the Plan tab");
  });
});
