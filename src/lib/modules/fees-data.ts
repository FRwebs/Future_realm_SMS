import { armRows } from "@/lib/modules/school-data";

/**
 * Money, for the sample school.
 *
 * One list of payments, read by Collections (the recent ones), by History (all
 * of them) and by the receipt itself — so a figure on a table and a figure on a
 * document can never disagree. A payment is FULL or PART; nothing else about it
 * matters more.
 */

export type FeePayment = {
  ref: string;
  student: string;
  admission: string;
  arm: string;
  amount: number;
  billed: number;
  method: string;
  bankRef: string;
  recordedBy: string;
  date: string;
  kind: "Full payment" | "Part payment";
  /** A payment taken offline is provisional until it syncs and is confirmed. */
  state: "Final" | "Provisional";
};

const paymentSeed: Array<
  [string, string, string, string, number, number, string, string, string, string]
> = [
  ["GIA/RCP/26/1843", "Chioma Adebayo", "GIA/2026/0402", "SSS 2A", 60000, 339000, "Bank transfer", "GTB/2609/884120", "Mr Tunde Bakare", "4 Sep"],
  ["GIA/RCP/26/1842", "Fatima Bello", "GIA/2026/0409", "SSS 2A", 339000, 339000, "Bank transfer", "GTB/2609/883914", "Mrs Chinelo Obi", "3 Sep"],
  ["GIA/RCP/26/1841", "Blessing Ade", "GIA/2026/0418", "SSS 1A", 180000, 318000, "Online card", "FLW/PS/882014", "Mrs Chinelo Obi", "3 Sep"],
  ["GIA/RCP/26/1840", "Emeka Okafor", "GIA/2026/0407", "SSS 2A", 120000, 339000, "Cash at the bursary", "—", "Mrs Chinelo Obi", "2 Sep"],
  ["GIA/RCP/26/P-09", "Ngozi Chukwu", "GIA/2026/0415", "SSS 1A", 95000, 318000, "Cash · offline", "—", "Miss Grace Etim", "2 Sep"],
  ["GIA/RCP/26/1838", "David Eze", "GIA/2026/0421", "SSS 2A", 339000, 339000, "Cheque", "CHQ/004812", "Mrs Chinelo Obi", "1 Sep"],
  ["GIA/RCP/26/1837", "Tunde Ogunlesi", "GIA/2026/0405", "SSS 2A", 271000, 339000, "POS card", "POS/2608/119043", "Mrs Chinelo Obi", "1 Sep"],
  ["GIA/RCP/26/1836", "Aisha Mohammed", "GIA/2026/0412", "SSS 2A", 85000, 339000, "USSD transfer", "USSD/771/4420", "Mr Tunde Bakare", "29 Aug"],
  ["GIA/RCP/26/1835", "Samuel Bature", "GIA/2026/0433", "JSS 3B", 149000, 249000, "Bank transfer", "GTB/2608/771043", "Mr Tunde Bakare", "28 Aug"],
  ["GIA/RCP/26/1834", "Peter Nwachukwu", "GIA/2026/0301", "SSS 3A", 412000, 412000, "Bank draft", "DRF/2208/0091", "Mrs Chinelo Obi", "27 Aug"],
  ["GIA/RCP/26/1833", "Halima Sule", "GIA/2026/0221", "JSS 2A", 249000, 249000, "Mobile money", "OPAY/8827/11", "Mr Tunde Bakare", "26 Aug"],
  ["GIA/RCP/26/1832", "Kelechi Obi", "GIA/2026/0118", "JSS 1A", 110000, 236000, "Bank transfer", "ZEN/2608/22014", "Mrs Chinelo Obi", "25 Aug"],
  ["GIA/RCP/26/1831", "Amina Yusuf", "GIA/2026/0142", "JSS 1C", 236000, 236000, "Bank transfer", "GTB/2608/770991", "Mrs Chinelo Obi", "22 Aug"],
  ["GIA/RCP/26/1830", "Segun Ade", "GIA/2026/0512", "Primary 5", 88000, 184000, "Cash at the bursary", "—", "Miss Grace Etim", "21 Aug"],
  ["GIA/RCP/26/1829", "Zainab Bello", "GIA/2026/0308", "JSS 3B", 249000, 249000, "Online card", "FLW/PS/881002", "Mrs Chinelo Obi", "20 Aug"],
  ["GIA/RCP/26/1828", "Ibrahim Musa", "GIA/2026/0614", "Nursery 2", 64000, 142000, "POS card", "POS/2608/118220", "Mr Tunde Bakare", "19 Aug"],
];

export const feePayments: FeePayment[] = paymentSeed.map((seed) => ({
  ref: seed[0],
  student: seed[1],
  admission: seed[2],
  arm: seed[3],
  amount: seed[4],
  billed: seed[5],
  method: seed[6],
  bankRef: seed[7],
  recordedBy: seed[8],
  date: seed[9],
  kind: seed[4] >= seed[5] ? "Full payment" : "Part payment",
  state: /P-/.test(seed[0]) ? "Provisional" : "Final",
}));

/**
 * The termly fee per class, read off the billed column of the receipts above —
 * so the structure a family is shown and the amount on their receipt agree.
 */
export const termlyFeeByClass: Record<string, number> = {
  "Nursery 1": 142000,
  "Nursery 2": 142000,
  "Primary 1": 184000,
  "Primary 2": 184000,
  "Primary 3": 184000,
  "Primary 4": 184000,
  "Primary 5": 184000,
  "Primary 6": 184000,
  "JSS 1": 236000,
  "JSS 2": 249000,
  "JSS 3": 249000,
  "SSS 1": 318000,
  "SSS 2": 339000,
  "SSS 3": 412000,
};

export function naira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

/** Short form for a headline: ₦48.2m. */
export function nairaShort(value: number): string {
  return `₦${(value / 1_000_000).toFixed(1)}m`;
}

/**
 * What the school has billed this term, from the same fee table the structures
 * page publishes and the same rolls every other module counts.
 */
export function schoolFees() {
  const billed = armRows.reduce(
    (total, row) => total + (termlyFeeByClass[row.className] ?? 0) * row.roll,
    0,
  );
  // The mockup's own collection rate at this point in the term.
  const collected = Math.round(billed * 0.757);

  return { billed, collected, owing: billed - collected, rate: 75.7 };
}

export type FeeStructureRow = {
  className: string;
  termly: number;
  arms: number;
  students: number;
  billed: number;
};

/** The published fee structure, class by class. */
export function feeStructures(): FeeStructureRow[] {
  const byClass = new Map<string, { arms: number; students: number }>();
  for (const row of armRows) {
    const entry = byClass.get(row.className) ?? { arms: 0, students: 0 };
    entry.arms += 1;
    entry.students += row.roll;
    byClass.set(row.className, entry);
  }

  return [...byClass.entries()].map(([className, entry]) => {
    const termly = termlyFeeByClass[className] ?? 0;
    return {
      className,
      termly,
      arms: entry.arms,
      students: entry.students,
      billed: termly * entry.students,
    };
  });
}

export type DebtorFamily = {
  family: string;
  children: string;
  arm: string;
  amount: number;
  days: number;
  bucket: "Current" | "30 days" | "60 days" | "90+ days";
  stage: string;
  contact: string;
};

/**
 * Families still owing, built from the part-paid receipts so a balance here and
 * a receipt there can never disagree.
 */
export function debtorFamilies(): DebtorFamily[] {
  return feePayments
    .filter((payment) => payment.amount < payment.billed)
    .map((payment, index) => {
      const days = 34 + ((index * 23) % 96);
      return {
        family: payment.student,
        children: "1 child",
        arm: payment.arm,
        amount: payment.billed - payment.amount,
        days,
        bucket:
          days > 90 ? "90+ days" : days > 60 ? "60 days" : days > 30 ? "30 days" : "Current",
        stage:
          days > 90
            ? "Meeting requested"
            : days > 60
              ? "Second reminder"
              : days > 30
                ? "First reminder"
                : "Not started",
        contact: payment.method.includes("Cash") ? "Phone only" : "Phone and email",
      } satisfies DebtorFamily;
    })
    .sort((left, right) => right.days - left.days);
}
