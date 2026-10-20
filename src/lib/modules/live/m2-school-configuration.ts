import { clearSampleDrawer, loadSample, type SampleStatus } from "@/lib/modules/live/m1-trial";
import { apiGet } from "@/lib/api/server";
import {
  POLICY_DEFINITIONS,
  policySub,
  summarisePolicy,
  type PolicyDefinition,
  type PolicyValues,
} from "@/lib/modules/school-policies";
import { approvalRoutes } from "@/lib/modules/approval-routes";
import {
  name as nameCell,
  pill,
  text,
  type DrawerSpec,
  type FormField,
  type ListItem,
  type PanelFact,
  type PanelTone,
  type TabContent,
  type TableRow,
} from "@/lib/modules/panels";

/**
 * M02 School Configuration, read from `GET /v1/configuration/:resource`.
 *
 * That module already owns this ground — school-information, sessions-terms,
 * school-calendar, subjects and class-levels are all resources it serves and
 * accepts writes for — so this tab needed no new endpoint. What it needed was
 * to stop describing a school and start showing one.
 *
 * Every write here goes back through the same module: the profile form PATCHes
 * school-information, and the calendar's buttons POST to sessions-terms and
 * school-calendar. Nothing on this page reports a change it did not make.
 */

type SchoolRecord = {
  id: string;
  name: string;
  slug: string;
  category: string;
  schoolCode: string | null;
  address: string | null;
  city: string | null;
  lga: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  academicYearLabel: string;
  termLabel: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  cacNumber: string | null;
  ministryApprovalNumber: string | null;
  subdomain: string | null;
  verifiedAt: string | null;
  estimatedStudentCount: number | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  shortName: string | null;
  motto: string | null;
  vision: string | null;
  schoolType: string | null;
  curriculumPreference: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  levelsOperated: string[];
  composition: string | null;
  attendancePattern: string[];
  stagesOperated: string[];
  /** Stages worked out from the class levels, for a school that has not said which it runs. */
  derivedStages: string[];
  foundedYear: number | null;
  mainPhone: string | null;
  postalCode: string | null;
  regulatingAuthority: string | null;
  approvalExpiresAt: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  showMottoUnderLogo: boolean;
  brandingAppliesTo: string[];
  dpaStatus: string;
  lastEdited: { at: string; by: string | null; byYou: boolean } | null;
};

type BrandingVersion = {
  id: string;
  logoUrl: string | null;
  primaryColour: string;
  secondaryColour: string;
  appliedTo: string;
  status: string;
  createdAt: string;
};

type TermRecord = {
  id: string;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  breakStart?: string | null;
  breakEnd?: string | null;
  /** "MON" … "SUN" — which weekdays the school sits. */
  schoolDays?: string[];
  activateOnOpen?: boolean;
};

type SessionRecord = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: TermRecord[];
};

type CalendarRecord = {
  id: string;
  title: string;
  category?: string | null;
  startsAt: string;
  endsAt: string;
  description?: string | null;
  audience?: string;
  type?: string;
  location?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  schoolClosed?: boolean;
  visibleTo?: string[];
  reminder?: string | null;
  secondReminder?: string | null;
  reminderChannels?: string[];
};

type AssessmentWindowRecord = {
  id: string;
  termId: string;
  termName: string;
  componentId: string;
  componentName: string;
  componentCode: string | null;
  maxScore: number;
  weight: number;
  opensAt: string;
  closesAt: string;
  releaseAt: string;
  appliesTo: string;
  remindTeachers: boolean;
  allowLateEntry: boolean;
  reopenedAt: string | null;
  reopenedReason: string | null;
};

type SubjectRecord = {
  id: string;
  name: string;
  code: string | null;
  /** The resource returns the id only — it does not join the department name. */
  departmentId: string | null;
  section: string | null;
  isCore: boolean | null;
  isOptional: boolean | null;
  isWaecSubject: boolean | null;
  periodsPerWeek: number | null;
  /** Which stream a subject belongs to: SCIENCE, BUSINESS, HUMANITIES, or none. */
  trackSpecific: string | null;
  tradeSubject: boolean | null;
  requiresLab: boolean | null;
  applicableClassLevels: string[] | null;
  waecCode: string | null;
  necoCode: string | null;
  status: string | null;
};

type ClassLevelRecord = { id: string; name: string; order: number };

type AssessmentComponentRecord = {
  id: string;
  name: string;
  code: string | null;
  maxScore: number | null;
  weight?: number | null;
  termId?: string | null;
  isActive: boolean;
};

type GradingBand = {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  remark: string | null;
  order: number;
};

type GradingScheme = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rankingEnabled: boolean;
  passMark: number | null;
  bands: GradingBand[];
};

type SectionComponent = {
  id: string;
  section: string;
  name: string;
  code: string | null;
  type: string;
  weight: number;
  maxScore: number;
  isActive: boolean;
  order: number;
};

const CONFIG = "/api/v1/configuration";

/** The note panel takes an SVG path, not an icon name; its default is a warning triangle. */
const CHECK_ICON = "M20 6 9 17l-5-5";

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ─────────────────────────── Profile ─────────────────────────── */

const SCHOOL_TYPES = ["Private", "Public / government", "Mission", "Community"];
const COMPOSITIONS = ["Co-educational", "Boys only", "Girls only"];
const ATTENDANCE_PATTERNS = ["Day", "Boarding"];
const STAGES = ["Early Years", "Nursery", "Primary", "Junior Secondary", "Senior Secondary"];
const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "Rwanda", "United Kingdom"];
const AUTHORITIES = [
  "FCT Secondary Education Board",
  "State Ministry of Education",
  "Federal Ministry of Education",
];
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
  "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
const BRANDED_DOCUMENTS = ["Report cards", "Transcripts", "Receipts", "The guardian portal", "Outgoing email"];

/** A select must hold the value it already has, even when the list has never heard of it. */
function withCurrent(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

/**
 * Older records hold one sentence in `schoolType` — "Private · co-educational ·
 * day and boarding" — where the mockup asks three separate questions. Read what
 * is there into the three, so the form opens on the truth rather than a default.
 */
function schoolTypeOf(school: SchoolRecord): string {
  const raw = (school.schoolType ?? "").toLowerCase();
  if (raw.includes("public") || raw.includes("government")) return "Public / government";
  if (raw.includes("mission")) return "Mission";
  if (raw.includes("community")) return "Community";
  return "Private";
}

function compositionOf(school: SchoolRecord): string {
  if (school.composition) return school.composition;
  const raw = (school.schoolType ?? "").toLowerCase();
  if (raw.includes("boys")) return "Boys only";
  if (raw.includes("girls")) return "Girls only";
  return "Co-educational";
}

function patternOf(school: SchoolRecord): string[] {
  if (school.attendancePattern?.length) return school.attendancePattern;
  const raw = (school.schoolType ?? "").toLowerCase();
  const found = ATTENDANCE_PATTERNS.filter((item) => raw.includes(item.toLowerCase()));
  return found.length ? found : ["Day"];
}

function stagesOf(school: SchoolRecord): string[] {
  const chosen = school.stagesOperated?.length ? school.stagesOperated : school.derivedStages;
  return STAGES.filter((stage) => chosen?.includes(stage));
}

function patternWords(pattern: string[]): string {
  if (pattern.length > 1) return "day and boarding";
  return pattern[0]?.toLowerCase() === "boarding" ? "boarding" : "day";
}

function dayValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "Approval expires in 15 months" — or that it already has. */
function expiryPhrase(iso: string | null | undefined): string {
  if (!iso) return "No approval expiry on record";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return "No approval expiry on record";
  if (days < 0) return `Approval expired ${Math.abs(Math.round(days / 30)) || 1} month${Math.abs(Math.round(days / 30)) === 1 ? "" : "s"} ago`;
  if (days < 45) return `Approval expires in ${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.4);
  return `Approval expires in ${months} month${months === 1 ? "" : "s"}`;
}

function fileLabel(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("data:")) return "On file";
  return url.split("/").pop() || url;
}

const SCHOOL_ENDPOINT = (school: SchoolRecord) => `${CONFIG}/school-information/${school.id}`;

function identityDrawer(school: SchoolRecord) {
  const stagesNow = stagesOf(school);
  return {
    mode: "form" as const,
    kicker: "School profile",
    title: "Edit identity",
    commitLabel: "Save identity",
    commitDone: "Identity saved",
    commitDoneBody: "The school name here is what prints on every report card issued from now on.",
    reviewNote:
      "The school name and short name appear on printed cards and in every SMS. Check the spelling.",
    fields: [
      {
        label: "School name",
        kind: "text" as const,
        value: school.name,
        required: true,
        span: 2 as const,
        hint: "Exactly as it should print on a report card and a transcript",
      },
      {
        label: "Short name",
        kind: "text" as const,
        value: school.shortName ?? "",
        required: true,
        hint: "Used in SMS, where every character is paid for",
      },
      { label: "Motto", kind: "text" as const, value: school.motto ?? "" },
      {
        label: "Vision statement",
        kind: "area" as const,
        value: school.vision ?? "",
        span: 2 as const,
        hint: "Prints on the inside cover of the report card if your design uses it.",
      },
      {
        label: "School type",
        kind: "select" as const,
        value: schoolTypeOf(school),
        options: SCHOOL_TYPES,
        required: true,
      },
      {
        label: "Composition",
        kind: "select" as const,
        value: compositionOf(school),
        options: COMPOSITIONS,
        required: true,
      },
      {
        label: "Attendance pattern",
        kind: "checks" as const,
        checked: patternOf(school),
        options: ATTENDANCE_PATTERNS,
        required: true,
      },
      {
        label: "Levels operated",
        kind: "checks" as const,
        checked: stagesNow,
        options: STAGES,
        required: true,
        span: 2 as const,
        hint: "Removing a level you already have students in is refused.",
      },
      {
        label: "Year founded",
        kind: "text" as const,
        value: school.foundedYear ? String(school.foundedYear) : "",
      },
      {
        label: "Main contact number",
        kind: "text" as const,
        value: school.mainPhone ?? school.ownerPhone ?? "",
        required: true,
      },
    ],
    submit: {
      endpoint: SCHOOL_ENDPOINT(school),
      method: "PATCH" as const,
      map: {
        "School name": "name",
        "Short name": "shortName",
        Motto: "motto",
        "Vision statement": "vision",
        "School type": "schoolType",
        Composition: "composition",
        "Attendance pattern": "attendancePattern",
        "Levels operated": "stagesOperated",
        "Year founded": "foundedYear",
        "Main contact number": "mainPhone",
      },
    },
  };
}

function addressDrawer(school: SchoolRecord) {
  const country = school.country ?? "Nigeria";
  const inNigeria = country === "Nigeria";
  return {
    mode: "form" as const,
    kicker: "School profile",
    title: "Edit address & authority",
    commitLabel: "Save address & authority",
    commitDone: "Address and authority saved",
    commitDoneBody: "Returns and printed documents use this address from now.",
    reviewNote:
      "These details appear on official documents and are checked by the regulator. Verify every number.",
    fields: [
      {
        label: "Country",
        kind: "select" as const,
        value: country,
        options: withCurrent(COUNTRIES, country),
        required: true,
        hint: "Sets the registration-number pattern and the phone format",
      },
      inNigeria
        ? {
            label: "State / region",
            kind: "select" as const,
            value: school.state ?? "Federal Capital Territory",
            options: withCurrent(NIGERIAN_STATES, school.state),
            required: true,
          }
        : { label: "State / region", kind: "text" as const, value: school.state ?? "", required: true },
      {
        label: "Street address",
        kind: "text" as const,
        value: school.address ?? "",
        required: true,
        span: 2 as const,
      },
      { label: "Town / city", kind: "text" as const, value: school.city ?? "", required: true },
      { label: "Postal code", kind: "text" as const, value: school.postalCode ?? "", optional: true },
      {
        label: "Registration number",
        kind: "text" as const,
        value: school.cacNumber ?? "",
        required: true,
        hint: "As it appears on the school's certificate of registration",
      },
      {
        label: "Authority approval number",
        kind: "text" as const,
        value: school.ministryApprovalNumber ?? "",
        required: true,
      },
      {
        label: "Approval expires",
        kind: "text" as const,
        type: "date" as const,
        value: dayValue(school.approvalExpiresAt),
        required: true,
        hint: "The profile counts down to this date",
      },
      {
        label: "Regulating authority",
        kind: "select" as const,
        value: school.regulatingAuthority ?? AUTHORITIES[0],
        options: withCurrent(AUTHORITIES, school.regulatingAuthority),
        required: true,
        span: 2 as const,
      },
      {
        label: "Principal",
        kind: "static" as const,
        value: school.principalName
          ? `${school.principalName}${school.principalPhone ? ` · ${school.principalPhone}` : ""}`
          : "None appointed",
        hint: "Read from the staff record — change it in Staff & Access.",
        span: 2 as const,
      },
      { label: "Proprietor", kind: "text" as const, value: school.ownerName ?? "", required: true },
      { label: "Proprietor’s phone", kind: "text" as const, value: school.ownerPhone ?? "", required: true },
    ],
    submit: {
      endpoint: SCHOOL_ENDPOINT(school),
      method: "PATCH" as const,
      map: {
        Country: "country",
        "State / region": "state",
        "Street address": "address",
        "Town / city": "city",
        "Postal code": "postalCode",
        "Registration number": "cacNumber",
        "Authority approval number": "ministryApprovalNumber",
        "Approval expires": "approvalExpiresAt",
        "Regulating authority": "regulatingAuthority",
        Proprietor: "ownerName",
        "Proprietor’s phone": "ownerPhone",
      },
    },
  };
}

function brandingDrawer(school: SchoolRecord, branding: BrandingVersion[]) {
  const nextVersion = branding.length + 1;
  const appliesTo = school.brandingAppliesTo?.length
    ? school.brandingAppliesTo
    : BRANDED_DOCUMENTS.slice(0, 4);
  return {
    mode: "form" as const,
    kicker: "School profile",
    title: "Edit branding",
    commitLabel: "Save branding",
    commitDone: `Branding saved as version ${nextVersion}`,
    commitDoneBody:
      "The version before it is kept. Anything already printed keeps the branding it was printed with.",
    reviewNote:
      "Saving creates a new branding version. Documents already issued are never restyled retroactively.",
    fields: [
      {
        label: "Current logo",
        kind: "static" as const,
        value: fileLabel(school.logoUrl, "None uploaded"),
        hint: "What is on the school record today",
      },
      {
        label: "Logo",
        kind: "asset" as const,
        options: ["Keep the current logo", "Upload a new one", "Remove it"] as [string, string, string],
        span: 2 as const,
      },
      {
        label: "Primary brand colour",
        kind: "text" as const,
        value: school.primaryColor ?? "#0D2315",
        required: true,
        hint: "Used for headers and the report card masthead",
      },
      {
        label: "Accent colour",
        kind: "text" as const,
        value: school.secondaryColor ?? "#12796A",
        required: true,
        hint: "Used for highlights and links",
      },
      {
        label: "Principal’s signature",
        kind: "asset" as const,
        options: ["Keep the signature on file", "Upload a new one", "Remove it"] as [string, string, string],
        span: 2 as const,
        hint: "Prints on report cards, transcripts and testimonials",
      },
      {
        label: "School stamp",
        kind: "asset" as const,
        options: ["Keep the stamp on file", "Upload a new one", "Remove it"] as [string, string, string],
        span: 2 as const,
      },
      {
        label: "Web address",
        kind: "static" as const,
        value: school.subdomain ? `${school.subdomain}.futurerealm.school` : school.slug,
        span: 2 as const,
        hint: "Changed by request, not edited here — the address is how families reach the school.",
      },
      {
        label: "Apply this branding to",
        kind: "checks" as const,
        checked: appliesTo,
        options: BRANDED_DOCUMENTS,
        span: 2 as const,
        required: true,
      },
      {
        label: "Show the school motto under the logo",
        kind: "toggle" as const,
        on: school.showMottoUnderLogo ?? true,
        onLabel: "Motto shown",
        offLabel: "Logo only",
      },
    ],
    submit: {
      endpoint: SCHOOL_ENDPOINT(school),
      method: "PATCH" as const,
      map: {
        Logo: "logoUrl",
        "Primary brand colour": "primaryColor",
        "Accent colour": "secondaryColor",
        "Principal’s signature": "signatureUrl",
        "School stamp": "stampUrl",
        "Apply this branding to": "brandingAppliesTo",
        "Show the school motto under the logo": "showMottoUnderLogo",
      },
    },
  };
}

function brandingHistoryDrawer(branding: BrandingVersion[]) {
  return {
    kicker: "Branding",
    title: "Version history",
    sub: branding.length
      ? "Every version, newest first, and what it was applied to."
      : "Nothing has been versioned yet.",
    readOnly: true,
    readOnlyNote:
      "A card already issued keeps the branding it was printed with. History is never rewritten.",
    facts: branding.length
      ? (branding.map((version, index) => [
          `Version ${branding.length - index}`,
          `${version.primaryColour} and ${version.secondaryColour}`,
          `${version.status === "APPLIED" ? "In force" : "Superseded"} · ${dateLabel(version.createdAt)} · ${version.appliedTo.replace(/_/g, " ")}`,
        ]) as PanelFact[])
      : ([
          ["Versions on file", "none"],
          [
            "Why",
            "Branding has only ever been set directly on the school record. The next save creates version 1.",
          ],
        ] as PanelFact[]),
  };
}

function agreementFacts(school: SchoolRecord): PanelFact[] {
  const signed = /signed|accepted/i.test(school.dpaStatus ?? "");
  return [
    ["Version", signed ? "Not recorded" : "Not accepted", signed ? "The status is on file; its version is not" : "No version has been accepted"],
    ["Accepted on", "Not recorded"],
    ["Accepting officer", "Not recorded"],
    ["Data controller", school.name],
    ["Processor", "FutureRealm"],
    ["Hosting country", "Not recorded"],
  ];
}

function agreementDrawer(school: SchoolRecord) {
  const signed = /signed|accepted/i.test(school.dpaStatus ?? "");
  return {
    kicker: "Data processing",
    title: "Data processing agreement",
    sub: signed ? "The school's status on file." : "Nothing has been accepted yet.",
    readOnly: true,
    readOnlyNote:
      "The product records whether the agreement is signed. It does not store the agreement's text, its version or who accepted it, so none of that is shown here as though it were.",
    facts: [
      ["Status on file", signed ? "Signed" : "Pending", `Recorded as ${school.dpaStatus ?? "PENDING"}`],
      ...agreementFacts(school).slice(3),
    ] as PanelFact[],
  };
}

function profileTab(school: SchoolRecord, branding: BrandingVersion[], sample: SampleStatus = { loaded: false }): TabContent {
  const place = [school.address, school.city, school.state].filter(Boolean).join(", ");
  const stages = stagesOf(school);
  const pattern = patternOf(school);
  const inForce = branding.find((version) => version.status === "APPLIED") ?? branding[0] ?? null;
  const version = inForce ? branding.length - branding.indexOf(inForce) : 0;
  const signed = /signed|accepted/i.test(school.dpaStatus ?? "");
  const principal = school.principalName
    ? `${school.principalName}${school.principalPhone ? ` · ${school.principalPhone}` : ""}`
    : "None appointed";
  const proprietor = school.ownerName
    ? `${school.ownerName}${school.ownerPhone ? ` · ${school.ownerPhone}` : ""}`
    : "Not recorded";
  const edited = school.lastEdited
    ? `Last edited ${new Date(school.lastEdited.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}${
        school.lastEdited.byYou ? " by you" : school.lastEdited.by ? ` by ${school.lastEdited.by}` : ""
      }`
    : "No edit recorded yet";

  return {
    title: "Profile",
    desc: "Who this school is.",
    primary: { label: "Edit identity", drawer: identityDrawer(school) },
    launchers: [
      { label: "Edit address & authority", drawer: addressDrawer(school) },
      { label: "Edit branding", drawer: brandingDrawer(school, branding) },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "Identity",
            sub: "The school name here is the name printed on every report card.",
            meta: edited,
            per: 3,
            acts: [{ label: "Edit identity", primary: true, drawer: identityDrawer(school) }],
            facts: [
              ["School name", school.name, "As printed on report cards"],
              ["Short name", school.shortName ?? "Not set", "Used in SMS, where characters cost money"],
              ["Motto", school.motto ?? "Not recorded"],
              ["Vision", school.vision ?? "Not recorded"],
              [
                "School type",
                `${schoolTypeOf(school)} · ${compositionOf(school).toLowerCase()} · ${patternWords(pattern)}`,
              ],
              ["Levels operated", stages.length ? stages.join(" · ") : "None configured"],
            ],
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Address and authority",
            sub: "Registration numbers are what a return is checked against.",
            meta: expiryPhrase(school.approvalExpiresAt),
            per: 2,
            acts: [{ label: "Edit address & authority", primary: true, drawer: addressDrawer(school) }],
            facts: [
              [
                "Country",
                [school.country ?? "Nigeria", school.state].filter(Boolean).join(" · "),
              ],
              ["Address", place || "Not recorded"],
              [
                "Registration number",
                school.cacNumber ?? "Not recorded",
                school.cacNumber ? "Asked for on every return" : "Required to file a return",
              ],
              [
                "Authority approval",
                school.ministryApprovalNumber ?? "Not recorded",
                school.approvalExpiresAt
                  ? `Expires ${longDate(school.approvalExpiresAt)}`
                  : "No expiry recorded",
              ],
              ["Principal", principal, "Read from the staff record"],
              ["Proprietor", proprietor],
            ],
          },
          {
            type: "facts",
            title: "Branding",
            tag: version ? `Version ${version} in force` : "No version recorded",
            tagTone: version ? "positive" : "attention",
            sub: "Anything already printed keeps the branding it was printed with.",
            per: 2,
            acts: [
              { label: "Version history", drawer: brandingHistoryDrawer(branding) },
              { label: "Edit branding", primary: true, drawer: brandingDrawer(school, branding) },
            ],
            facts: [
              [
                "Logo",
                fileLabel(school.logoUrl, "None uploaded"),
                school.logoUrl ? undefined : "Upload one in Edit branding",
              ],
              [
                "Brand colours",
                `${school.primaryColor ?? "unset"} and ${school.secondaryColor ?? "unset"}`,
              ],
              [
                "Principal’s signature",
                school.signatureUrl ? "On file" : "Not on file",
                "Prints on report cards and transcripts",
              ],
              ["School stamp", school.stampUrl ? "On file" : "Not on file"],
              [
                "Web address",
                school.subdomain ? `${school.subdomain}.futurerealm.school` : school.slug,
              ],
              ["Change of address", "By request only", "Handled by Nooria, not edited here"],
            ],
          },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          {
            type: "facts",
            title: "Data processing agreement",
            tag: signed ? "Signed" : "Not accepted",
            tagTone: signed ? "positive" : "attention",
            sub: "The full text is readable here.",
            per: 2,
            acts: [{ label: "Read full text", drawer: agreementDrawer(school) }],
            facts: agreementFacts(school),
          },
          sample.loaded
            ? {
                type: "note" as const,
                tone: "neutral" as const,
                title: "A sample class is loaded",
                body: `${sample.students} sample students, with a term of attendance, scores and report cards. Everything it made is listed, so it can be removed whole without touching what you have added.`,
                acts: [{ label: "Remove the sample class", drawer: clearSampleDrawer(sample) }],
              }
            : {
                type: "note" as const,
                tone: "positive" as const,
                title: "No sample data in this school",
                body: "Everything here is the school's own. If a sample class was loaded at signup, it has been removed.",
              },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Calendar ─────────────────────────── */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December",
];
const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_SCHOOL_DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const REMINDERS = ["No reminder", "On the day", "1 day before", "3 days before", "7 days before", "14 days before", "30 days before"];
const EVENT_TYPES = ["School event", "Holiday", "Examination", "Meeting", "Deadline", "Sports", "Religious observance"];
const EVENT_AUDIENCES = ["Staff", "Students", "Guardians", "The public calendar"];
const REMINDER_CHANNELS = ["In-app", "SMS", "Email"];
const WINDOW_AUDIENCES = ["Every class", "Junior Secondary only", "Senior Secondary only"];

const DAY_MS = 86_400_000;

/** Dates travel as "YYYY-MM-DD"; reading them as UTC keeps a day from sliding across midnight. */
function utcDay(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function parts(iso: string): { day: number; month: number; year: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { day, month: (month || 1) - 1, year };
}

/** "8 Sep 2025" */
function fullDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { day, month, year } = parts(iso);
  return `${day} ${MONTHS_SHORT[month]} ${year}`;
}

/** "19 Jan" */
function shortDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { day, month } = parts(iso);
  return `${day} ${MONTHS_SHORT[month]}`;
}

/** "27–31 Oct", "30 Oct–3 Nov", "27 Oct" */
export function dayRange(from: string, to: string, months: string[] = MONTHS_SHORT): string {
  const a = parts(from);
  const b = parts(to);
  if (from.slice(0, 10) === to.slice(0, 10)) return `${a.day} ${months[a.month]}`;
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${months[a.month]}`;
  return `${a.day} ${months[a.month]}–${b.day} ${months[b.month]}`;
}

/** Every day an event keeps the school shut, so a term's school days can leave them out. */
function closedDays(events: CalendarRecord[]): Set<number> {
  const closed = new Set<number>();
  for (const event of events) {
    if (!event.schoolClosed) continue;
    for (let t = utcDay(event.startsAt); t <= utcDay(event.endsAt); t += DAY_MS) closed.add(t);
  }
  return closed;
}

/**
 * School days in a term: the weekdays the school sits, between the day it opens
 * and the day it closes, less the mid-term break and any day an event closes the
 * school. This is the denominator attendance is measured against, so it is worth
 * being exact about.
 */
export function countSchoolDays(
  term: Pick<TermRecord, "startDate" | "endDate" | "breakStart" | "breakEnd" | "schoolDays">,
  closed: Set<number>,
): number {
  const days = term.schoolDays?.length ? term.schoolDays : DEFAULT_SCHOOL_DAYS;
  const breakFrom = term.breakStart ? utcDay(term.breakStart) : null;
  const breakTo = term.breakEnd ? utcDay(term.breakEnd) : null;
  let count = 0;
  for (let t = utcDay(term.startDate); t <= utcDay(term.endDate); t += DAY_MS) {
    if (!days.includes(WEEKDAY_CODES[new Date(t).getUTCDay()])) continue;
    if (breakFrom !== null && breakTo !== null && t >= breakFrom && t <= breakTo) continue;
    if (closed.has(t)) continue;
    count += 1;
  }
  return count;
}

function termState(term: TermRecord): { label: string; tone: PanelTone } {
  const today = todayUtc();
  if (term.isCurrent) return { label: "Active", tone: "positive" };
  if (today > utcDay(term.endDate)) return { label: "Closed", tone: "neutral" };
  if (today < utcDay(term.startDate)) return { label: "Not started", tone: "neutral" };
  return { label: "Not active", tone: "attention" };
}

function windowState(window: AssessmentWindowRecord): { label: string; tone: PanelTone } {
  const today = todayUtc();
  if (today > utcDay(window.closesAt)) return { label: "Closed", tone: "neutral" };
  if (today < utcDay(window.opensAt)) return { label: "Not started", tone: "neutral" };
  return { label: "In progress", tone: "progress" };
}

function eventState(event: CalendarRecord): { label: string; tone: PanelTone } {
  const today = todayUtc();
  if (today > utcDay(event.endsAt)) return { label: "Over", tone: "neutral" };
  if (today < utcDay(event.startsAt)) return { label: "Not started", tone: "neutral" };
  return { label: "In progress", tone: "progress" };
}

/** Who an event is for, in the three words the form uses — read from the older audience string where nothing newer was written. */
function eventAudience(event: CalendarRecord): string[] {
  if (event.visibleTo?.length) return event.visibleTo;
  const raw = (event.audience ?? "").toLowerCase();
  if (!raw || raw.includes("all") || raw.includes("school")) return ["Staff", "Students", "Guardians"];
  const found: string[] = [];
  if (raw.includes("staff") || raw.includes("teacher")) found.push("Staff");
  if (raw.includes("student") || raw.includes("learner")) found.push("Students");
  if (raw.includes("parent") || raw.includes("guardian")) found.push("Guardians");
  return found.length ? found : ["Staff", "Students", "Guardians"];
}

function reminderShort(reminder: string | null | undefined): string {
  if (!reminder || reminder === "No reminder") return "no reminder";
  if (reminder === "On the day") return "same-day reminder";
  const days = reminder.match(/^(\d+) days? before$/);
  return days ? `${days[1]}-day reminder` : reminder.toLowerCase();
}

function sessionTermsLabel(term: TermRecord, siblings: number): string {
  return `Term ${term.order} of ${siblings}`;
}

const CALENDAR_SOURCE = "Calendar";

function termFields(
  term: TermRecord | null,
  sessionNames: string[],
  sessionName: string,
): FormField[] {
  const sitting = (term?.schoolDays?.length ? term.schoolDays : DEFAULT_SCHOOL_DAYS)
    .map((code) => WEEKDAY_LABELS.find((label) => label.toUpperCase() === code))
    .filter((label): label is string => Boolean(label));
  return [
    {
      label: "Term name",
      kind: "text",
      value: term?.name ?? "",
      placeholder: "Third Term",
      required: true,
      hint: "The name your school uses",
    },
    ...(term
      ? []
      : ([
          {
            label: "Session",
            kind: "select",
            value: sessionName,
            options: sessionNames,
            required: true,
          },
        ] as FormField[])),
    { label: "Opens", kind: "text", type: "date", value: term ? term.startDate.slice(0, 10) : "", required: true },
    { label: "Closes", kind: "text", type: "date", value: term ? term.endDate.slice(0, 10) : "", required: true },
    {
      label: "Mid-term break starts",
      kind: "text",
      type: "date",
      value: term?.breakStart?.slice(0, 10) ?? "",
      optional: true,
    },
    {
      label: "Mid-term break ends",
      kind: "text",
      type: "date",
      value: term?.breakEnd?.slice(0, 10) ?? "",
      optional: true,
    },
    {
      label: "School days",
      kind: "checks",
      checked: sitting,
      options: WEEKDAY_LABELS,
      required: true,
      span: 2,
      hint: "Used to count school days and attendance denominators",
    },
    ...(term
      ? []
      : ([
          {
            label: "Make this the active term when it opens",
            kind: "toggle",
            on: false,
            onLabel: "Becomes active automatically",
            offLabel: "You will switch to it yourself",
          },
        ] as FormField[])),
  ];
}

const TERM_MAP = {
  "Term name": "name",
  Opens: "startDate",
  Closes: "endDate",
  "Mid-term break starts": "breakStart",
  "Mid-term break ends": "breakEnd",
  "School days": "schoolDays",
};

function addTermDrawer(sessions: SessionRecord[], termCount: number): DrawerSpec {
  const current = sessions.find((item) => item.isCurrent) ?? sessions[0];
  const names = sessions.map((item) => item.name);
  return {
    mode: "form",
    kicker: CALENDAR_SOURCE,
    title: "Add term",
    commitLabel: "Create term",
    commitDone: "Term created",
    commitDoneBody: "It is in the calendar now. Attendance, results and fees can be scoped to it.",
    reviewNote:
      "School days are counted from the dates and the weekly pattern, minus holidays and breaks.",
    fields: termFields(null, names.length ? names : ["No session yet"], current?.name ?? "No session yet"),
    submit: {
      endpoint: `${CONFIG}/sessions-terms`,
      method: "POST",
      body: { recordType: "term", order: termCount + 1 },
      map: {
        ...TERM_MAP,
        Session: "academicSessionId",
        "Make this the active term when it opens": "activateOnOpen",
      },
      encode: { Session: Object.fromEntries(sessions.map((item) => [item.name, item.id])) },
    },
  };
}

function editTermDrawer(term: TermRecord, session: SessionRecord): DrawerSpec {
  return {
    mode: "edit",
    kicker: `Terms in ${session.name}`,
    title: term.name,
    commitDone: `${term.name} saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: termFields(term, [session.name], session.name),
    submit: {
      endpoint: `${CONFIG}/sessions-terms/${term.id}`,
      method: "PATCH",
      map: TERM_MAP,
      reasonKey: "reason",
      reasonRequired: true,
    },
    remove: {
      endpoint: `${CONFIG}/sessions-terms/${term.id}`,
      noun: "term",
      warn: `“${term.name}” will be removed from the calendar. A term that attendance, fees or a timetable already point at cannot be deleted.`,
    },
  };
}

function changeActiveTermDrawer(terms: Array<{ term: TermRecord; sessionName: string }>): DrawerSpec {
  const current = terms.find((item) => item.term.isCurrent);
  const labels = terms.map((item) => `${item.term.name} · ${item.sessionName}`);
  return {
    mode: "form",
    kicker: "Active term",
    title: "Change active term",
    commitLabel: "Make it the active term",
    commitDone: "Active term changed",
    commitDoneBody:
      "Attendance percentages, collection rates, submission deadlines and report cards are now computed against it.",
    reviewNote:
      "Every dated figure in the product moves with the active term. Nothing already recorded is changed.",
    fields: [
      {
        label: "Currently active",
        kind: "static",
        value: current ? `${current.term.name} · ${current.sessionName}` : "No term is active",
      },
      {
        label: "Make this the active term",
        kind: "select",
        value: labels.find((label) => !current || label !== `${current.term.name} · ${current.sessionName}`) ?? labels[0],
        options: labels,
        required: true,
        span: 2,
      },
    ],
    submit: {
      endpoint: `${CONFIG}/sessions-terms/active`,
      method: "PATCH",
      map: { "Make this the active term": "termId" },
      encode: {
        "Make this the active term": Object.fromEntries(
          terms.map((item, index) => [labels[index], item.term.id]),
        ),
      },
    },
  };
}

function rollOverDrawer(
  terms: Array<{ term: TermRecord; sessionName: string }>,
): DrawerSpec {
  const ordered = terms
    .slice()
    .sort((a, b) => utcDay(a.term.startDate) - utcDay(b.term.startDate));
  const current = ordered.find((item) => item.term.isCurrent);
  const next = current
    ? ordered.find((item) => utcDay(item.term.startDate) > utcDay(current.term.startDate))
    : undefined;

  if (!current || !next) {
    return {
      kicker: CALENDAR_SOURCE,
      title: "Close the term & roll over",
      sub: current ? "There is no later term to move to." : "No term is active.",
      readOnly: true,
      readOnlyNote: current
        ? "Closing a term makes the next one active. Add the next term first, then come back."
        : "There is no active term to close. Make one active first.",
      facts: [
        ["Active term", current ? `${current.term.name} · ${current.sessionName}` : "None"],
        ["Next term", "None defined yet"],
      ] as PanelFact[],
    };
  }

  return {
    mode: "commit",
    kicker: CALENDAR_SOURCE,
    title: "Close the term & roll over",
    sub: `${current.term.name} closes, and ${next.term.name} becomes the active term.`,
    commitLabel: "Close the term",
    commitNote: "Nothing already recorded is changed.",
    commitDone: `${next.term.name} is now the active term`,
    commitDoneBody:
      "Attendance, results and fees now count against it. Promotion of students is run from Student Records, not here.",
    facts: [
      ["Closing", `${current.term.name} · ${current.sessionName}`, `Ran ${fullDay(current.term.startDate)} to ${fullDay(current.term.endDate)}`],
      ["Becoming active", `${next.term.name} · ${next.sessionName}`, `Opens ${fullDay(next.term.startDate)}`],
      ["Records", "Kept exactly as they are", "Closing a term never rewrites what happened in it"],
      ["Not done here", "Promoting students", "Run from Student Records once results are published"],
    ] as PanelFact[],
    submit: {
      endpoint: `${CONFIG}/sessions-terms/active`,
      method: "PATCH",
      body: { termId: next.term.id },
    },
  };
}

function windowFields(
  window: AssessmentWindowRecord | null,
  componentLabels: string[],
  componentLabel: string,
  termLabels: string[],
  termLabel: string,
): FormField[] {
  return [
    window
      ? { label: "Component", kind: "static", value: window.componentName, hint: "A window belongs to one component" }
      : {
          label: "Component",
          kind: "select",
          value: componentLabel,
          options: componentLabels,
          required: true,
          hint: "From your assessment framework",
        },
    window
      ? { label: "Term", kind: "static", value: window.termName }
      : { label: "Term", kind: "select", value: termLabel, options: termLabels, required: true },
    {
      label: "Maximum score",
      kind: "text",
      value: window ? String(window.maxScore) : "",
      optional: !window,
      required: Boolean(window),
      hint: window ? undefined : "Leave blank to keep what the component already has",
    },
    {
      label: "Weight (%)",
      kind: "text",
      value: window ? String(window.weight) : "",
      optional: !window,
      required: Boolean(window),
      hint: window ? "All components must total 100" : "Blank keeps the component's own weight. All must total 100",
    },
    {
      label: "Opens",
      kind: "text",
      type: "date",
      value: window?.opensAt ?? "",
      required: true,
      hint: "Entry is refused before this date",
    },
    {
      label: "Closes",
      kind: "text",
      type: "date",
      value: window?.closesAt ?? "",
      required: true,
      hint: "Sheets lock after this date",
    },
    {
      label: "Result release",
      kind: "text",
      type: "date",
      value: window?.releaseAt ?? "",
      required: true,
      hint: "When guardians can see it — never before approval",
    },
    {
      label: "Applies to",
      kind: "select",
      value: window?.appliesTo ?? WINDOW_AUDIENCES[0],
      options: withCurrent(WINDOW_AUDIENCES, window?.appliesTo),
      required: true,
    },
    {
      label: "Remind teachers 3 days before it closes",
      kind: "toggle",
      on: window?.remindTeachers ?? true,
      onLabel: "Reminder on",
      offLabel: "No reminder",
    },
    {
      label: "Allow late entry with a reason",
      kind: "toggle",
      on: window?.allowLateEntry ?? false,
      onLabel: "Late entry allowed, logged",
      offLabel: "Hard close",
    },
  ];
}

const WINDOW_MAP = {
  "Maximum score": "maxScore",
  "Weight (%)": "weight",
  Opens: "opensAt",
  Closes: "closesAt",
  "Result release": "releaseAt",
  "Applies to": "appliesTo",
  "Remind teachers 3 days before it closes": "remindTeachers",
  "Allow late entry with a reason": "allowLateEntry",
};

function eventFields(event: CalendarRecord | null): FormField[] {
  const type = event?.type ?? "School event";
  return [
    {
      label: "Event name",
      kind: "text",
      value: event?.title ?? "",
      placeholder: "Parents’ consultation day",
      required: true,
      span: 2,
    },
    { label: "Type", kind: "select", value: type, options: withCurrent(EVENT_TYPES, type), required: true },
    { label: "Start date", kind: "text", type: "date", value: event ? event.startsAt.slice(0, 10) : "", required: true },
    {
      label: "End date",
      kind: "text",
      type: "date",
      value: event && event.endsAt.slice(0, 10) !== event.startsAt.slice(0, 10) ? event.endsAt.slice(0, 10) : "",
      optional: true,
      hint: "Leave blank for a single-day event",
    },
    { label: "Start time", kind: "text", value: event?.startTime ?? "", placeholder: "09:00", optional: true },
    { label: "End time", kind: "text", value: event?.endTime ?? "", placeholder: "14:00", optional: true },
    {
      label: "All day",
      kind: "toggle",
      on: event?.allDay ?? false,
      onLabel: "All day — no times shown",
      offLabel: "Uses the times above",
    },
    { label: "Location", kind: "text", value: event?.location ?? "", placeholder: "School hall", optional: true, span: 2 },
    {
      label: "Description",
      kind: "area",
      value: event?.description ?? "",
      placeholder: "What this is, and anything attendees must bring or know.",
      span: 2,
    },
    {
      label: "Visible to",
      kind: "checks",
      checked: event ? eventAudience(event) : ["Staff", "Guardians"],
      options: EVENT_AUDIENCES,
      required: true,
      span: 2,
    },
    {
      label: "Reminder",
      kind: "select",
      value: event ? event.reminder ?? "No reminder" : "7 days before",
      options: REMINDERS,
      required: true,
      hint: "Sent to everyone the event is visible to",
    },
    {
      label: "Second reminder",
      kind: "select",
      value: event ? event.secondReminder ?? "No reminder" : "1 day before",
      options: REMINDERS,
      hint: "Optional — set to No reminder to skip",
    },
    {
      label: "Send the reminder by",
      kind: "checks",
      checked: event?.reminderChannels?.length ? event.reminderChannels : ["In-app"],
      options: REMINDER_CHANNELS,
      span: 2,
      hint: "SMS costs credits — the count is shown before it sends",
    },
    {
      label: "Close the school on this day",
      kind: "toggle",
      on: event?.schoolClosed ?? false,
      onLabel: "School closed — excluded from attendance",
      offLabel: "Normal school day",
    },
  ];
}

const EVENT_MAP = {
  "Event name": "title",
  Type: "type",
  "Start date": "startsAt",
  "End date": "endsAt",
  "Start time": "startTime",
  "End time": "endTime",
  "All day": "allDay",
  Location: "location",
  Description: "description",
  "Visible to": "visibleTo",
  Reminder: "reminder",
  "Second reminder": "secondReminder",
  "Send the reminder by": "reminderChannels",
  "Close the school on this day": "schoolClosed",
};

function addEventDrawer(): DrawerSpec {
  return {
    mode: "form",
    kicker: CALENDAR_SOURCE,
    title: "Add event",
    commitLabel: "Create event",
    commitDone: "Event added to the calendar",
    commitDoneBody:
      "Everyone you made it visible to sees it in their calendar, and the reminder is scheduled.",
    reviewNote: "Check the dates and who will see this before it goes onto everyone’s calendar.",
    fields: eventFields(null),
    submit: { endpoint: `${CONFIG}/school-calendar`, method: "POST", map: EVENT_MAP },
  };
}

function eventFacts(event: CalendarRecord): PanelFact[] {
  const closes = event.endsAt.slice(0, 10) !== event.startsAt.slice(0, 10);
  const facts: PanelFact[] = [
    ["Event", event.title],
    ["Type", event.type ?? "School event", event.type === "Holiday" ? undefined : undefined],
    ["Start date", fullDay(event.startsAt)],
  ];
  if (closes) facts.push(["End date", fullDay(event.endsAt)]);
  if (event.allDay) facts.push(["All day", "Yes"]);
  else {
    if (event.startTime) facts.push(["Start time", event.startTime]);
    if (event.endTime) facts.push(["End time", event.endTime]);
  }
  if (event.location) facts.push(["Location", event.location]);
  if (event.schoolClosed) facts.push(["School closed", "Yes", "Excluded from every attendance denominator"]);
  facts.push(["Visible to", eventAudience(event).join(", ")]);
  facts.push([
    "Reminder",
    event.reminder && event.reminder !== "No reminder" ? event.reminder : "No reminder",
    event.reminder && event.reminder !== "No reminder" && event.reminderChannels?.length
      ? `Sent by ${event.reminderChannels.join(", ")}`
      : undefined,
  ]);
  if (event.secondReminder && event.secondReminder !== "No reminder") {
    facts.push(["Second reminder", event.secondReminder]);
  }
  facts.push(["State", eventState(event).label]);
  return facts;
}

function eventItem(event: CalendarRecord): ListItem {
  const state = eventState(event);
  const audience = eventAudience(event).join(", ").toLowerCase();
  const closed = event.schoolClosed ? " · school closed" : "";
  const edit: DrawerSpec = {
    mode: "edit",
    kicker: "Events",
    title: event.title,
    commitDone: `${event.title} saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: eventFields(event),
    submit: {
      endpoint: `${CONFIG}/school-calendar/${event.id}`,
      method: "PATCH",
      map: EVENT_MAP,
      reasonKey: "reason",
      reasonRequired: true,
    },
    remove: {
      endpoint: `${CONFIG}/school-calendar/${event.id}`,
      noun: "event",
      warn: `“${event.title}” will be taken off everyone’s calendar, and its reminders will not be sent.`,
    },
  };
  return {
    label: event.title,
    sub: `${dayRange(event.startsAt, event.endsAt, MONTHS_LONG)} · ${audience} · ${reminderShort(event.reminder)}${closed}`,
    pill: state.label,
    tone: state.tone,
    viewLabel: "Edit",
    drawer: {
      mode: "view",
      kicker: "Events",
      title: event.title,
      facts: eventFacts(event),
      edit,
      remove: edit.remove,
    },
  };
}

function windowRow(
  window: AssessmentWindowRecord,
  termName: string,
  componentLabels: string[],
  termLabels: string[],
): TableRow {
  const state = windowState(window);
  const edit: DrawerSpec = {
    mode: "edit",
    kicker: "Assessment windows",
    title: window.componentName,
    commitDone: `${window.componentName} window saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: windowFields(window, componentLabels, window.componentName, termLabels, termName),
    submit: {
      endpoint: `${CONFIG}/assessment-windows/${window.id}`,
      method: "PATCH",
      map: WINDOW_MAP,
      reasonKey: "reopenReason",
      reasonRequired: true,
    },
    remove: {
      endpoint: `${CONFIG}/assessment-windows/${window.id}`,
      noun: "assessment window",
      warn: `The window for “${window.componentName}” will be removed. The component itself, and every score entered against it, stays.`,
    },
  };
  return {
    cells: [
      nameCell(window.componentName, `Max ${window.maxScore} · weight ${window.weight}%`, { avatar: false }),
      text(shortDay(window.opensAt)),
      text(shortDay(window.closesAt)),
      text(shortDay(window.releaseAt)),
      pill(state.label, state.tone),
      { kind: "action" as const, label: "Edit", drawer: edit },
    ],
    keywords: `${window.componentName} ${window.componentCode ?? ""} ${termName}`,
  };
}

/**
 * M02 · Calendar, in the mockup's shape: the active term first because every
 * dated figure moves with it, then the terms, then the assessment windows beside
 * the events. Every box on it opens a form that saves for real.
 */
function calendarTab(
  sessions: SessionRecord[],
  events: CalendarRecord[],
  components: AssessmentComponentRecord[],
  windows: AssessmentWindowRecord[],
): TabContent {
  const current = sessions.find((item) => item.isCurrent) ?? sessions[0];
  const terms = sessions.flatMap((item) => item.terms.map((term) => ({ term, sessionName: item.name })));
  const currentTerm = terms.find((item) => item.term.isCurrent);
  const closed = closedDays(events);
  const sessionTerms = current?.terms ?? [];
  const totalDays = sessionTerms.reduce((sum, term) => sum + countSchoolDays(term, closed), 0);

  const activeComponents = components.filter((item) => item.isActive);
  const dupes = new Set(
    activeComponents.map((item) => item.name).filter((nameValue, index, all) => all.indexOf(nameValue) !== index),
  );
  const componentLabelFor = (item: AssessmentComponentRecord) =>
    dupes.has(item.name) ? `${item.name} · ${item.code ?? item.id.slice(0, 4)}` : item.name;
  const componentLabels = activeComponents.map(componentLabelFor);
  const termLabels = terms.map((item) => `${item.term.name} · ${item.sessionName}`);
  const currentTermLabel = currentTerm
    ? `${currentTerm.term.name} · ${currentTerm.sessionName}`
    : termLabels[0] ?? "";

  const termWindows = currentTerm
    ? windows.filter((item) => item.termId === currentTerm.term.id)
    : windows;
  // What the framework weighs in total — every component that counts this term,
  // not just the ones that already have a window.
  const weightTotal = activeComponents
    .filter((item) => !item.termId || !currentTerm || item.termId === currentTerm.term.id)
    .reduce((sum, item) => sum + (item.weight ?? 0), 0);

  const addWindowDrawer: DrawerSpec = {
    mode: "form",
    kicker: "Assessment windows",
    title: "Add assessment window",
    commitLabel: "Create window",
    commitDone: "Assessment window created",
    commitDoneBody:
      "Teachers can enter scores for this component between the open and close dates, and not outside them.",
    reviewNote:
      "Scores can only be entered while the window is open. Results release to guardians on the release date.",
    fields: windowFields(
      null,
      componentLabels.length ? componentLabels : ["No component yet"],
      componentLabels[0] ?? "No component yet",
      termLabels.length ? termLabels : ["No term yet"],
      currentTermLabel || "No term yet",
    ),
    submit: {
      endpoint: `${CONFIG}/assessment-windows`,
      method: "POST",
      map: { ...WINDOW_MAP, Component: "componentId", Term: "termId" },
      encode: {
        Component: Object.fromEntries(activeComponents.map((item) => [componentLabelFor(item), item.id])),
        Term: Object.fromEntries(terms.map((item, index) => [termLabels[index], item.term.id])),
      },
    },
  };

  const eventsThisTerm = currentTerm
    ? events.filter(
        (item) =>
          utcDay(item.endsAt) >= utcDay(currentTerm.term.startDate) &&
          utcDay(item.startsAt) <= utcDay(currentTerm.term.endDate),
      ).length
    : events.length;

  return {
    title: "Calendar",
    desc: "When the school operates.",
    primary: { label: "Add term", drawer: addTermDrawer(sessions, sessionTerms.length) },
    launchers: [
      { label: "Add an event", drawer: addEventDrawer() },
      { label: "Add an assessment window", drawer: addWindowDrawer },
      { label: "Close the term & roll over", drawer: rollOverDrawer(terms) },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          currentTerm
            ? {
                type: "note",
                tone: "positive",
                icon: CHECK_ICON,
                title: `Active term · ${currentTerm.term.name}, ${currentTerm.sessionName} session`,
                body: "Every dated figure in the product — attendance percentages, collection rates, submission deadlines, report cards — is computed against this term.",
                acts: [{ label: "Change active term", drawer: changeActiveTermDrawer(terms) }],
              }
            : {
                type: "note",
                tone: "negative",
                title: "No term is active",
                body: "Attendance cannot be marked, results cannot be entered and fees have no period to fall due in. Choosing the active term is the first thing this school needs.",
                acts: terms.length ? [{ label: "Choose the active term", drawer: changeActiveTermDrawer(terms) }] : undefined,
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          sessionTerms.length
            ? {
                type: "table",
                title: `Terms in ${current?.name ?? "this session"}`,
                sub: "As many terms as the school runs, named by the school.",
                meta: `${sessionTerms.length} term${sessionTerms.length === 1 ? "" : "s"} defined · ${totalDays} school days`,
                acts: [{ label: "Add term", primary: true, drawer: addTermDrawer(sessions, sessionTerms.length) }],
                head: ["Term", "Opens", "Closes", "Days", "Mid-term break", "State", ""],
                noun: "term",
                nounPlural: "terms",
                per: 10,
                rows: sessionTerms.map((term) => {
                  const state = termState(term);
                  return {
                    cells: [
                      nameCell(term.name, sessionTermsLabel(term, sessionTerms.length), { avatar: false }),
                      text(fullDay(term.startDate)),
                      text(fullDay(term.endDate)),
                      text(String(countSchoolDays(term, closed)), { strong: true, mono: true }),
                      text(term.breakStart && term.breakEnd ? dayRange(term.breakStart, term.breakEnd) : "No break"),
                      pill(state.label, state.tone),
                      { kind: "action" as const, label: "Edit", drawer: editTermDrawer(term, current as SessionRecord) },
                    ],
                    keywords: `${term.name} ${current?.name ?? ""}`,
                  };
                }),
              }
            : {
                type: "note",
                tone: "negative",
                title: "No term is configured",
                body: "Attendance, results and fees are all scoped to a term. Until one exists those modules have nothing to count against.",
                acts: [{ label: "Add term", drawer: addTermDrawer(sessions, 0) }],
              },
        ],
      },
      {
        cols: "1.15fr 1fr",
        panels: [
          termWindows.length
            ? {
                type: "table",
                title: "Assessment windows",
                sub: "When each component can be scored, and when the result reaches a guardian.",
                meta: `${termWindows.length} window${termWindows.length === 1 ? "" : "s"} · weights total ${Math.round(weightTotal * 10) / 10}`,
                acts: [{ label: "Add window", primary: true, drawer: addWindowDrawer }],
                head: ["Component", "Opens", "Closes", "Result release", "State", ""],
                noun: "assessment window",
                nounPlural: "windows",
                per: 8,
                rows: termWindows.map((item) =>
                  windowRow(item, item.termName, componentLabels, termLabels),
                ),
                foot: "A window that has closed can be reopened, with a reason, from its own modal.",
              }
            : {
                type: "note",
                tone: "attention",
                title: activeComponents.length
                  ? `No assessment window is set${currentTerm ? ` for ${currentTerm.term.name}` : ""}`
                  : "No assessment component is configured",
                body: activeComponents.length
                  ? "Until a window exists, a teacher can score any component at any time. A window says when each one opens, closes and releases."
                  : "Scores are entered against components. Without them there is nothing to score into, and nothing for a window to govern.",
                acts: activeComponents.length ? [{ label: "Add window", drawer: addWindowDrawer }] : undefined,
              },
          events.length
            ? {
                type: "list",
                title: "Events",
                sub: "Each with its dates, who sees it, and when they are reminded.",
                meta: `${events.length} event${events.length === 1 ? "" : "s"}${currentTerm ? ` · ${eventsThisTerm} this term` : ""}`,
                acts: [{ label: "Add event", primary: true, drawer: addEventDrawer() }],
                items: events.map(eventItem),
                foot: "Open any event to change its dates, visibility or reminders — or to delete it.",
              }
            : {
                type: "note",
                tone: "attention",
                title: "No calendar event is recorded",
                body: "No holiday, resumption date or examination window is on file. Nothing on this page can tell a family when the term starts, and the Command Center's term milestones have nothing to count towards.",
                acts: [{ label: "Add event", drawer: addEventDrawer() }],
              },
        ],
      },
    ],
  };
}

/* ─────────────────────────── Curriculum ─────────────────────────── */

/** The school's own spelling for a stage, where the enum's is not it. */
const SECTION_LABELS: Record<string, string> = {
  CRECHE: "Crèche",
  PRE_NURSERY: "Pre-nursery",
  KINDERGARTEN: "Kindergarten",
  JUNIOR_SECONDARY: "Junior Secondary",
  SENIOR_SECONDARY: "Senior Secondary",
};

function sectionLabel(section: string | null): string {
  if (!section) return "Unassigned";
  if (SECTION_LABELS[section]) return SECTION_LABELS[section];
  return section
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type CurriculumRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  data: Record<string, unknown> | null;
};

type DepartmentRecord = {
  id: string;
  name: string;
  code: string;
  subjectCount: number;
  staffCount: number;
};

/** The stages a school runs, in the order a child passes through them. */
const SECTION_ORDER = [
  "CRECHE",
  "PRE_NURSERY",
  "NURSERY",
  "KINDERGARTEN",
  "PRIMARY",
  "JUNIOR_SECONDARY",
  "SENIOR_SECONDARY",
] as const;

/** What a person picks, paired with what the column actually stores. */
const SECTION_VALUES: Record<string, string> = Object.fromEntries(
  SECTION_ORDER.map((section) => [sectionLabel(section), section]),
);

const COMPONENT_KINDS: Record<string, string> = {
  Assignment: "ASSIGNMENT",
  Classwork: "CLASSWORK",
  Test: "TEST",
  Project: "PROJECT",
  Practical: "PRACTICAL",
  Examination: "EXAMINATION",
};

const TRACK_VALUES: Record<string, string> = {
  "No stream": "",
  Science: "SCIENCE",
  Business: "BUSINESS",
  Humanities: "HUMANITIES",
};

const SUBJECTS_ENDPOINT = "/api/v1/configuration/subjects";

/** Add or change a subject, in the same drawer either way. */
function subjectDrawer(
  subject: SubjectRecord | null,
  sections: string[],
  departments: DepartmentRecord[],
) {
  const departmentValues = Object.fromEntries(
    departments.map((department) => [department.name, department.id]),
  );
  const trackName =
    Object.entries(TRACK_VALUES).find(([, value]) => value === (subject?.trackSpecific ?? ""))?.[0] ??
    "No stream";

  return {
    mode: (subject ? "edit" : "form") as "edit" | "form",
    kicker: subject ? "Edit subject" : "New subject",
    title: subject ? subject.name : "Add a subject",
    sub: subject
      ? "A change here reaches every class that offers it."
      : "A subject is offered by a section, and taken by the class levels in it.",
    commitLabel: subject ? "Save the subject" : "Add the subject",
    commitDone: subject ? `${subject.name} saved` : "Subject added",
    commitDoneBody: "The catalogue now carries it. Class & Timetable can place it from here.",
    fields: [
      { kind: "text" as const, label: "Name", required: true, span: 2 as const, value: subject?.name ?? "" },
      {
        kind: "text" as const,
        label: "Code",
        required: true,
        value: subject?.code ?? "",
        hint: "Short and unique \u2014 it prints on a report card",
      },
      {
        kind: "select" as const,
        label: "Section",
        required: true,
        options: sections,
        value: subject?.section ? sectionLabel(subject.section) : sections[0],
      },
      {
        kind: "select" as const,
        label: "Department",
        options: departments.map((department) => department.name),
        value:
          departments.find((department) => department.id === subject?.departmentId)?.name ??
          departments[0]?.name ??
          "",
      },
      {
        kind: "select" as const,
        label: "Stream",
        options: Object.keys(TRACK_VALUES),
        value: trackName,
        hint: "Restricts the subject to one stream, or leaves it open to all",
      },
      {
        kind: "toggle" as const,
        label: "Every student takes it",
        on: Boolean(subject?.isCore),
        onLabel: "Core",
        offLabel: "Elective",
      },
    ],
    submit: {
      endpoint: subject ? `${SUBJECTS_ENDPOINT}/${subject.id}` : SUBJECTS_ENDPOINT,
      method: (subject ? "PATCH" : "POST") as "PATCH" | "POST",
      map: {
        Name: "name",
        Code: "code",
        Section: "section",
        Department: "departmentId",
        Stream: "trackSpecific",
        "Every student takes it": "isCore",
      },
      encode: { Section: SECTION_VALUES, Department: departmentValues, Stream: TRACK_VALUES },
    },
  };
}

/** Add or change one assessment component. */
function componentDrawer(component: SectionComponent | null, sections: string[], sectionTotal: number) {
  const kindName =
    Object.entries(COMPONENT_KINDS).find(([, value]) => value === component?.type)?.[0] ?? "Test";

  return {
    mode: "commit" as const,
    kicker: component ? `Edit component \u00b7 ${sectionLabel(component.section)}` : "New component",
    title: component ? component.name : "Add a component",
    sub: component
      ? `This section totals ${round1(sectionTotal)} today. It must still total 100 when you save.`
      : "A new component has to take its weight from the others \u2014 the section must still total 100.",
    commitLabel: component ? "Save the component" : "Add the component",
    commitNote:
      "Weights are what a term average is computed from. A set that does not total 100 is refused rather than half-applied.",
    commitDone: component ? `${component.name} saved` : "Component added",
    commitDoneBody: "Score Entry & Results will use these weights for the term.",
    fields: [
      { kind: "text" as const, label: "Name", required: true, span: 2 as const, value: component?.name ?? "" },
      {
        kind: "text" as const,
        label: "Code",
        required: true,
        value: component?.code ?? "",
        readOnly: Boolean(component),
        hint: component ? "A component's code never changes" : "Short and unique within the section",
      },
      {
        kind: "select" as const,
        label: "Kind",
        options: Object.keys(COMPONENT_KINDS),
        value: kindName,
      },
      ...(component
        ? []
        : [
            {
              kind: "select" as const,
              label: "Section",
              required: true,
              options: sections,
              value: sections[0],
            },
          ]),
      {
        kind: "text" as const,
        label: "Weight",
        unit: "% of the term",
        required: true,
        value: component ? round1(component.weight) : "",
      },
      {
        kind: "text" as const,
        label: "Maximum score",
        required: true,
        value: component ? round1(component.maxScore) : "",
      },
    ],
    submit: {
      endpoint: component
        ? `/api/v1/academics/section-assessment-components/${component.id}`
        : "/api/v1/academics/section-assessment-components",
      method: (component ? "PATCH" : "POST") as "PATCH" | "POST",
      map: {
        Name: "name",
        ...(component ? {} : { Code: "code", Section: "section" }),
        Kind: "type",
        Weight: "weight",
        "Maximum score": "maxScore",
      },
      encode: { Kind: COMPONENT_KINDS, Section: SECTION_VALUES },
    },
  };
}

/** Add or change one grading band. */
function bandDrawer(scheme: GradingScheme | undefined, band: GradingBand | null, bandCount: number) {
  return {
    mode: (band ? "edit" : "form") as "edit" | "form",
    kicker: scheme?.name ?? "Grading",
    title: band ? `${band.label} \u00b7 ${band.remark ?? "no label"}` : "Add a band",
    sub: band
      ? "Moving a line changes what every mark between it and its neighbour is called."
      : "A new band has to take its range from its neighbours \u2014 bands stay contiguous from 0 to 100.",
    commitLabel: band ? "Save the band" : "Add the band",
    commitNote:
      "Bands must cover every mark from 0 to 100 exactly once. A gap or an overlap is refused, and the refusal names the marks left uncovered.",
    commitDone: band ? "Band saved" : "Band added",
    commitDoneBody: "Report cards will call marks in this range by the new name.",
    fields: [
      { kind: "text" as const, label: "Grade", required: true, value: band?.label ?? "" },
      {
        kind: "text" as const,
        label: "What it is called",
        required: true,
        value: band?.remark ?? "",
      },
      { kind: "text" as const, label: "From", required: true, value: band ? String(Math.floor(band.minScore)) : "" },
      { kind: "text" as const, label: "To", required: true, value: band ? String(Math.floor(band.maxScore)) : "" },
      {
        kind: "text" as const,
        label: "Points",
        value: band ? String(band.order) : String(bandCount + 1),
        hint: "What this grade is worth when results are averaged",
      },
    ],
    submit: {
      endpoint: band
        ? `/api/v1/academics/grading-schemes/${scheme?.id}/bands/${band.id}`
        : `/api/v1/academics/grading-schemes/${scheme?.id}/bands`,
      method: (band ? "PATCH" : "POST") as "PATCH" | "POST",
      map: {
        Grade: "label",
        "What it is called": "remark",
        From: "minScore",
        To: "maxScore",
        Points: "order",
      },
    },
  };
}

/** A class level's enum name as the school writes it: JSS_1 -> JSS 1. */
function levelLabel(value: string): string {
  // PRIMARY_4 is "Primary 4" and JSS_1 is "JSS 1": the acronyms stay capitals,
  // everything else reads as a word.
  return value
    .split("_")
    .map((word) => {
      const lower = word.toLowerCase();
      if (["jss", "sss", "kg", "ss", "js"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** The span a subject is taught across, which is what a reader scans for. */
function levelSpan(levels: string[] | null): string {
  if (!levels?.length) return "\u2014";
  if (levels.length === 1) return levelLabel(levels[0]);
  return `${levelLabel(levels[0])} \u2013 ${levelLabel(levels[levels.length - 1])}`;
}

/** Which stream a subject belongs to, trade subjects counted as their own. */
function streamLabel(subject: SubjectRecord): string {
  if (subject.tradeSubject) return "Trade";
  if (!subject.trackSpecific) return "General";
  const word = subject.trackSpecific.toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The mockup's own icon for each of the six layers. */
const LAYER_ICONS = {
  levels: "M4 5h16v15H4zM4 9.5h16M9 9.5V20",
  subjects: "M6 3.5h12v17H6zM9.5 8.5h5M9.5 12.5h5",
  assessment: "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z",
  grading: "M3.5 20.5h17M7 20.5v-6M11.6 20.5V8.5M16.2 20.5v-9",
  report: "M6.5 3.5h8L18.5 8v12.5h-12zM14.5 3.5V8h4",
  versions: "M20 11.5a8 8 0 0 0-13.7-5L4 8.8M4 12.5a8 8 0 0 0 13.7 5l2.3-2.3M4 4.5v4.3h4.3",
} as const;

const LOCK_ICON = "M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v9h-13z";
const REPORT_ICON = "M6.5 3.5h8L18.5 8v12.5h-12zM9 12.5h6M9 16h4";

function round1(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * A band's range, printed the way a report card prints it. Bands are stored
 * with a fractional ceiling (69.99) so they cannot overlap, so the printed
 * top is truncated, never rounded — rounding 69.99 up to 70 would show two
 * bands both claiming 70.
 */
function bandRange(band: GradingBand): string {
  return `${Math.floor(band.minScore)}–${Math.floor(band.maxScore)}`;
}

/**
 * The six layers, each resolved against what the school has actually set. A
 * layer this module cannot see is reported as unset rather than assumed — the
 * figure above the tiles is only worth reading if an unset layer counts.
 */
function curriculumLayers(
  subjects: SubjectRecord[],
  levels: ClassLevelRecord[],
  scheme: GradingScheme | undefined,
  componentsBySection: Map<string, SectionComponent[]>,
) {
  const sections = Array.from(componentsBySection.keys());
  const offTotal = sections.filter((section) => {
    const total = (componentsBySection.get(section) ?? []).reduce((sum, item) => sum + item.weight, 0);
    return Math.round(total) !== 100;
  });
  const shared = componentsBySection.get(sections[0] ?? "") ?? [];
  const choiceGroups = new Set(subjects.filter((item) => !item.isCore).map((item) => item.section)).size;

  return [
    {
      key: "levels" as const,
      label: "Levels & Classes",
      set: levels.length > 0,
      sub: levels.length
        ? `${levels.length} class levels · ${levels[0]?.name} to ${levels[levels.length - 1]?.name}`
        : "Not set — the ladder students are promoted along",
      href: "/class-timetable/classes",
    },
    {
      key: "subjects" as const,
      label: "Subjects",
      set: subjects.length > 0,
      sub: subjects.length
        ? `${subjects.length} in catalogue · ${subjects.filter((item) => item.isCore).length} core · ${choiceGroups} choice groups`
        : "Not set — what may and must be taken",
      href: "/class-timetable/subjects",
    },
    {
      key: "assessment" as const,
      label: "Assessment",
      set: shared.length > 0 && offTotal.length === 0,
      sub: shared.length
        ? `${shared.length} components · weights total ${
            offTotal.length ? "off in " + offTotal.length + " section(s)" : "100"
          }`
        : "Not set — how a term becomes one number",
      href: "/score-results/components",
    },
    {
      key: "grading" as const,
      label: "Grading",
      set: Boolean(scheme?.bands.length),
      sub: scheme?.bands.length
        ? `${scheme.bands.length} bands · contiguous · pass ${scheme.passMark ?? "—"}`
        : "Not set — what a number is called",
      href: "/score-results/grading",
    },
    {
      key: "report" as const,
      label: "Report Card",
      set: false,
      sub: "Not set here — the layout is owned by Report Cards, not this module",
      href: "/report-cards/templates",
    },
    {
      key: "versions" as const,
      label: "Versions",
      set: false,
      sub: "No curriculum version history is kept yet — a change replaces the last",
      href: undefined,
    },
  ];
}

/**
 * M02 · Curriculum, in the mockup's shape: the standing figures, the one
 * curriculum in force, the rule that stops it being swapped, then the six
 * layers and the two tables a layer is actually made of.
 */
function curriculumTab(
  school: SchoolRecord,
  subjects: SubjectRecord[],
  levels: ClassLevelRecord[],
  schemes: GradingScheme[],
  components: SectionComponent[],
  built: CurriculumRecord[],
): TabContent {
  const scheme = schemes.find((item) => item.isActive) ?? schemes[0];
  const bands = (scheme?.bands ?? []).slice().sort((a, b) => a.order - b.order);

  const componentsBySection = new Map<string, SectionComponent[]>();
  for (const component of components.filter((item) => item.isActive)) {
    const list = componentsBySection.get(component.section) ?? [];
    list.push(component);
    componentsBySection.set(component.section, list);
  }
  for (const [, list] of componentsBySection) list.sort((a, b) => a.order - b.order);
  const sectionNames = Array.from(componentsBySection.keys());
  const shared = (componentsBySection.get(sectionNames[0] ?? "") ?? []).slice();
  const sharedTotal = shared.reduce((sum, item) => sum + item.weight, 0);
  /** Every section carries the same component set, so one table describes all of them. */

  const layers = curriculumLayers(subjects, levels, scheme, componentsBySection);
  const layersSet = layers.filter((layer) => layer.set).length;
  const layersShort = layers.filter((layer) => !layer.set);

  const basis = school.curriculumPreference ?? "Nigerian national curriculum";
  const inForce = layersSet > 0;
  /**
   * The mockup names a curriculum by the stages it spans ("Senior & Junior").
   * `levelsOperated` holds every class level, so naming from it yields a
   * twenty-item string — the stages come from the sections instead.
   */
  const stages = SECTION_ORDER.filter(
    (section) =>
      subjects.some((subject) => subject.section === section) || componentsBySection.has(section),
  );
  const span =
    stages.length > 1
      ? `${sectionLabel(stages[0])} to ${sectionLabel(stages[stages.length - 1])}`
      : stages.length === 1
        ? sectionLabel(stages[0])
        : "all levels";
  const curriculumName = `${school.name} · ${span}`;

  /** Only the sections and streams that exist are worth offering as filters. */
  const subjectStreams = Array.from(new Set(subjects.map(streamLabel))).sort();
  const restrictedStreams = subjectStreams.filter((stream) => stream !== "General");
  const electiveCount = subjects.filter((subject) => !subject.isCore).length;

  /**
   * The mockup's framework preview: every layer in one drawer, so the whole
   * curriculum can be read before anything is adopted or changed.
   *
   * The mockup previews the library standard it ships. There is no shared
   * library in this build, so this previews the framework actually in force —
   * same thirteen rows, this school's own figures, and a plain answer where a
   * layer is owned by another module rather than a number invented here.
   */
  const previewDrawer = {
    kicker: `${basis} \u00b7 ${span}`,
    title: "The framework in force",
    sub: "What this curriculum sets across all six layers.",
    readOnly: true,
    readOnlyNote:
      "Each layer is changed in the module that owns it. Nothing is edited from this preview.",
    facts: [
      [
        "Levels & Classes",
        levels.length ? `${stages.length} stages \u00b7 ${levels.length} class levels` : "Not set",
        levels.length ? `${levels[0]?.name} to ${levels[levels.length - 1]?.name}` : "",
      ],
      [
        "Streaming",
        restrictedStreams.length ? restrictedStreams.join(", ") : "No streaming",
        "Taken from the streams subjects are restricted to",
      ],
      ["Promotion", "Set in Policies", "This module does not hold the promotion rule"],
      [
        "Subjects",
        `${subjects.length} in the catalogue`,
        `${subjects.filter((item) => item.isCore).length} core \u00b7 ${electiveCount} elective`,
      ],
      [
        "Compulsory subjects",
        subjects.filter((item) => item.isCore).length
          ? `${subjects.filter((item) => item.isCore).length} marked core`
          : "None marked core",
        subjects
          .filter((item) => item.isCore)
          .slice(0, 3)
          .map((item) => item.name)
          .join(", "),
      ],
      [
        "Choice groups",
        // "General" is the absence of a stream, not a group to choose from.
        restrictedStreams.length ? `${restrictedStreams.length} streams` : "None",
        restrictedStreams.join(" · ") || "A student picks freely",
      ],
      [
        "Assessment",
        shared.length
          ? `${shared.length} components, totalling ${round1(sharedTotal)}`
          : "Not set",
        shared.map((item) => `${item.name} ${round1(item.weight)}`).join(", "),
      ],
      [
        "Absent handling",
        "Not configured here",
        "Score Entry & Results decides what an absent mark does to an average",
      ],
      [
        "Grading",
        bands.length
          ? `${bands.length} bands \u00b7 ${bands[0]?.label} to ${bands[bands.length - 1]?.label}`
          : "Not set",
        bands.length
          ? `Contiguous 0\u2013100 \u00b7 pass ${scheme?.passMark ?? "\u2014"}`
          : "",
      ],
      [
        "Position",
        scheme?.rankingEnabled ? "Ranked" : "Not ranked",
        scheme?.rankingEnabled ? "A position is computed for every student" : "No position is shown",
      ],
      ["Report card", "Owned by Report Cards", "The layout and what prints on it are set there"],
      ["Signatures", "Set on the report card template", "Not held by this module"],
      [
        "Version",
        "No version history is kept",
        "A change to a layer replaces the last, rather than creating a version",
      ],
    ] as PanelFact[],
  };




  return {
    title: "Curriculum",
    desc: "One is in force. The rest are yours to copy, build or archive.",
    primary: { label: "Build a curriculum", href: "/school-configuration/curriculum/build" },
    launchers: [
      { label: "Preview the framework in force", drawer: previewDrawer },
      { label: "Open the one in force", href: "/school-configuration/curriculum/in-force" },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "Curricula",
            per: 4,
            cards: [
              {
                label: "In force",
                value: inForce ? "1" : "0",
                sub: inForce
                  ? `${school.name} · ${levels.length} class levels`
                  : "Nothing set yet",
                tone: inForce ? "positive" : "attention",
              },
              {
                label: "Available to adopt",
                value: "0",
                sub: "No shared library in this build",
                tone: "neutral",
              },
              {
                label: "Your own drafts",
                value: String(built.filter((record) => record.status !== "ACTIVE").length),
                sub: built.length ? "Built here, not in force" : "Nothing built yet",
                tone: "neutral",
              },
              {
                label: "Layers needing attention",
                value: String(layersShort.length),
                sub: layersShort.length
                  ? layersShort.map((layer) => layer.label).join(", ")
                  : "All six defined",
                tone: layersShort.length ? "attention" : "positive",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "All curricula",
            tag: inForce ? "1 in force" : "none in force",
            tagTone: inForce ? "positive" : "attention",
            sub: built.length
              ? "Number 1 is the configuration in force. The rest were built here and are yours to finish, or put in force."
              : "This school keeps one. No shared library is available to adopt from in this build.",
            meta: `${built.length + 1} curricul${built.length ? "a" : "um"} · ${
              inForce ? "1 in force" : "none in force"
            }`,
            acts: [
              { label: "Preview the framework in force", drawer: previewDrawer },
              { label: "Build a curriculum", href: "/school-configuration/curriculum/build" },
            ],
            search: "Find a curriculum by name, origin or region",
            filters: [
              { label: "Origin", value: "All", options: ["All", "This school", "Shared library"] },
              { label: "State", value: "All", options: ["All", "In force", "Draft", "Archived"] },
            ],
            head: ["#", "Curriculum", "Origin", "Region / basis", "Layers", "State", "Levels", ""],
            noun: "curriculum",
            nounPlural: "curricula",
            per: 8,
            rows: [
              {
                cells: [
                  text("1", { strong: true }),
                  nameCell(curriculumName, school.schoolCode ?? school.slug),
                  text("This school"),
                  text(basis),
                  text(`${layersSet} of 6`, {
                    tone: layersShort.length ? "attention" : "positive",
                  }),
                  pill(inForce ? "In force" : "Draft", inForce ? "positive" : "progress"),
                  text(String(levels.length)),
                  {
                    kind: "action" as const,
                    label: "Open",
                    href: "/school-configuration/curriculum/in-force",
                  },
                ],
                keywords: `${curriculumName} this school ${basis}`,
              },
              ...built.map((record, index) => {
                const detail = (record.data ?? {}) as {
                  identity?: Record<string, string>;
                  assessment?: { components?: unknown[] };
                  grading?: { bands?: unknown[] };
                  sectionsComplete?: number;
                };
                const draft = record.status !== "ACTIVE";
                return {
                  cells: [
                    text(String(index + 2), { strong: true }),
                    nameCell(record.name, record.code ?? record.description ?? undefined),
                    text("This school"),
                    text(detail.identity?.["Region or awarding basis"] ?? "\u2014"),
                    text(`${detail.sectionsComplete ?? 0} of 7`, {
                      tone: (detail.sectionsComplete ?? 0) === 7 ? "positive" : "attention",
                    }),
                    pill(draft ? "Draft" : "Available", draft ? "progress" : "neutral"),
                    text("0"),
                    {
                      kind: "action" as const,
                      label: draft ? "Put in force" : "Open",
                      drawer: {
                        mode: "commit" as const,
                        kicker: draft ? "Draft curriculum" : "Curriculum",
                        title: draft ? `Put \u201c${record.name}\u201d in force` : record.name,
                        sub: draft
                          ? "This writes the grading bands and every section's assessment components."
                          : record.description || "In force.",
                        commitLabel: "Put it in force",
                        commitNote:
                          "A curriculum in force cannot be swapped mid-term. If scores have already been submitted this is refused, and it takes effect from the next term instead.",
                        commitDone: `${record.name} is in force`,
                        commitDoneBody:
                          "The grading bands and assessment components now match this curriculum. Results already issued keep the framework they were issued under.",
                        submit: {
                          endpoint: `/api/v1/configuration/curricula/${record.id}/apply`,
                          method: "POST" as const,
                          body: { effectiveFrom: "NEXT_TERM" },
                        },
                        facts: [
                          ["Name", record.name],
                          ["Code", record.code ?? "\u2014"],
                          ["State", draft ? "Draft \u2014 not in force" : "Available to adopt"],
                          ["Basis", detail.identity?.["Region or awarding basis"] ?? "\u2014"],
                          ["Language", detail.identity?.["Language of instruction"] ?? "\u2014"],
                          ["Assessment", `${detail.assessment?.components?.length ?? 0} components`],
                          ["Grading", `${detail.grading?.bands?.length ?? 0} bands`],
                          ["Sections complete", `${detail.sectionsComplete ?? 0} of 7`],
                        ] as PanelFact[],
                      },
                    },
                  ],
                  keywords: `${record.name} this school draft`,
                };
              }),
            ],
            foot: "The six configuration layers live inside a curriculum — open one to set them. Putting a curriculum in force replaces the current one from the next term.",
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "note",
            tone: "withheld",
            icon: LOCK_ICON,
            title: "A curriculum in force cannot be swapped mid-term",
            body: "Scores exist against the framework in force, so replacing it takes effect from the next term. Anything already issued keeps the framework it was issued under — a parent's report card is never restated behind them.",
            acts: [{ label: "Build a curriculum", href: "/school-configuration/curriculum/build" }],
          },
        ],
      },
    ],
  };
}

/**
 * M02 · one curriculum, opened from the list.
 *
 * The mockup opens a curriculum as a sub-page rather than a modal, and that is
 * the right shape for it: the six layers, the two tables a layer is made of and
 * the rules that lock them do not fit in a drawer, and nothing here is a single
 * decision to confirm. The list stays a list; this is the inside of one row.
 */
export function curriculumDetailContent(
  school: SchoolRecord,
  subjects: SubjectRecord[],
  levels: ClassLevelRecord[],
  schemes: GradingScheme[],
  components: SectionComponent[],
  departments: DepartmentRecord[],
): TabContent {
  const scheme = schemes.find((item) => item.isActive) ?? schemes[0];
  const bands = (scheme?.bands ?? []).slice().sort((a, b) => a.order - b.order);

  const componentsBySection = new Map<string, SectionComponent[]>();
  for (const component of components.filter((item) => item.isActive)) {
    const list = componentsBySection.get(component.section) ?? [];
    list.push(component);
    componentsBySection.set(component.section, list);
  }
  for (const [, list] of componentsBySection) list.sort((a, b) => a.order - b.order);
  const sectionNames = Array.from(componentsBySection.keys());
  const shared = (componentsBySection.get(sectionNames[0] ?? "") ?? []).slice();
  const sharedTotal = shared.reduce((sum, item) => sum + item.weight, 0);
  const sectionsOffTotal = sectionNames.filter(
    (section) =>
      Math.round(
        (componentsBySection.get(section) ?? []).reduce((sum, item) => sum + item.weight, 0),
      ) !== 100,
  );
  const identical =
    sectionNames.length > 1 &&
    sectionNames.every((section) => {
      const list = componentsBySection.get(section) ?? [];
      return (
        list.length === shared.length &&
        list.every(
          (item, index) => item.name === shared[index]?.name && item.weight === shared[index]?.weight,
        )
      );
    });

  const layers = curriculumLayers(subjects, levels, scheme, componentsBySection);
  const layersSet = layers.filter((layer) => layer.set).length;
  const layersShort = layers.filter((layer) => !layer.set);

  const subjectSections = SECTION_ORDER.filter((section) =>
    subjects.some((subject) => subject.section === section),
  ).map(sectionLabel);
  const subjectStreams = Array.from(new Set(subjects.map(streamLabel))).sort();
  const subjectSectionOptions = subjectSections.length ? subjectSections : SECTION_ORDER.map(sectionLabel);
  const departmentById = new Map(departments.map((item) => [item.id, item]));
  const departmentName = (subject: SubjectRecord) =>
    (subject.departmentId ? departmentById.get(subject.departmentId)?.name : undefined) ?? "Unassigned";
  const subjectDepartments = Array.from(new Set(subjects.map(departmentName))).sort();
  const electiveCount = subjects.filter((subject) => !subject.isCore).length;
  const unsectioned = subjects.filter((subject) => !subject.section).length;

  const subjectRows: TableRow[] = subjects.map((subject) => ({
    cells: [
      nameCell(subject.name, subject.code ?? undefined),
      pill(sectionLabel(subject.section), subject.section ? "neutral" : "attention"),
      text(levelSpan(subject.applicableClassLevels)),
      text(departmentName(subject), { tone: subject.departmentId ? undefined : "attention" }),
      pill(subject.isCore ? "Core" : "Elective", subject.isCore ? "positive" : "neutral"),
      text(streamLabel(subject)),
      {
        kind: "action" as const,
        label: "Edit",
        drawer: subjectDrawer(subject, subjectSectionOptions, departments),
      },
      {
        kind: "action" as const,
        label: "View",
        drawer: {
          mode: "view" as const,
          kicker: `${sectionLabel(subject.section)} \u00b7 ${streamLabel(subject)}`,
          title: subject.name,
          sub: subject.isCore
            ? "Every student at this level takes it."
            : "A student may take it, but is not required to.",
          readOnly: true,
          readOnlyNote:
            "Subjects are edited in Class & Timetable, which owns the catalogue this curriculum reads.",
          facts: [
            ["Subject", subject.name],
            ["Code", subject.code ?? "\u2014"],
            ["Section", sectionLabel(subject.section)],
            [
              "Department",
              departmentName(subject),
              subject.departmentId ? "" : "No department holds this subject",
            ],
            [
              "Class levels",
              subject.applicableClassLevels?.length
                ? subject.applicableClassLevels.map(levelLabel).join(", ")
                : "\u2014",
              `${subject.applicableClassLevels?.length ?? 0} level(s)`,
            ],
            ["Kind", subject.isCore ? "Core" : "Elective"],
            ["Stream", streamLabel(subject)],
            [
              "Periods a week",
              subject.periodsPerWeek ? String(subject.periodsPerWeek) : "\u2014",
              subject.periodsPerWeek ? "" : "Cannot be timetabled automatically",
            ],
            ["Trade subject", subject.tradeSubject ? "Yes" : "No"],
            ["Needs a laboratory", subject.requiresLab ? "Yes" : "No"],
            [
              "Certificate codes",
              [subject.waecCode, subject.necoCode].filter(Boolean).join(" \u00b7 ") || "None set",
              subject.isWaecSubject ? "Carried to the certificate" : "Not marked as a WAEC subject",
            ],
            ["State", subject.status ?? "\u2014"],
          ] as PanelFact[],
        },
      },
    ],
    keywords: `${subject.name} ${subject.code ?? ""} ${sectionLabel(subject.section)} ${streamLabel(
      subject,
    )} ${departmentName(subject)} ${subject.isCore ? "core" : "elective"}`,
  }));

  const stages = SECTION_ORDER.filter(
    (section) =>
      subjects.some((subject) => subject.section === section) || componentsBySection.has(section),
  );
  const span =
    stages.length > 1
      ? `${sectionLabel(stages[0])} to ${sectionLabel(stages[stages.length - 1])}`
      : stages.length === 1
        ? sectionLabel(stages[0])
        : "all levels";

  return {
    title: `${school.name} \u00b7 ${span}`,
    desc: "Six layers: what is taught, how it is scored, what a parent receives.",
    launchers: [{ label: "Back to all curricula", href: "/school-configuration/curriculum" }],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "This curriculum",
            per: 5,
            cards: [
              {
                label: "State",
                value: layersSet ? "In force" : "Draft",
                sub: layersSet ? "Used by every arm" : "Not in force",
                tone: layersSet ? "positive" : "progress",
              },
              {
                label: "Layers set",
                value: String(layersSet),
                unit: "of 6",
                sub: layersShort.length ? layersShort.map((layer) => layer.label).join(", ") : "All six defined",
                tone: layersShort.length ? "attention" : "positive",
              },
              {
                label: "Subjects",
                value: String(subjects.length),
                sub: `${subjectStreams.filter((stream) => stream !== "General").length} choice groups`,
              },
              {
                label: "Assessment",
                value: shared.length ? round1(sharedTotal) : "\u2014",
                unit: shared.length ? "of 100" : "",
                sub: sectionsOffTotal.length ? "Weights must total 100" : "Weights total 100",
                tone: sectionsOffTotal.length ? "attention" : "positive",
              },
              {
                label: "Class levels",
                value: String(levels.length),
                sub: levels.length ? `${levels[0]?.name} to ${levels[levels.length - 1]?.name}` : "None",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "tiles",
            title: "The six layers",
            tag: `${layersSet} of 6 set`,
            tagTone: layersShort.length ? "attention" : "positive",
            sub: "Open a layer to decide exactly what this curriculum does. Each one saves on its own.",
            per: 3,
            tiles: layers.map((layer) => ({
              label: layer.label,
              sub: layer.sub,
              icon: LAYER_ICONS[layer.key],
              tone: layer.set ? undefined : ("attention" as const),
              ...(layer.href ? { href: layer.href } : {}),
            })),
          },
        ],
      },
      {
        cols: "1.1fr 1fr",
        panels: [
          shared.length
            ? {
                type: "table",
                title: "Assessment components",
                tag: Math.round(sharedTotal) === 100 ? "Totals 100" : `Totals ${round1(sharedTotal)}`,
                tagTone: Math.round(sharedTotal) === 100 ? "positive" : "attention",
                meta: `${shared.length} components · weights total ${round1(sharedTotal)}`,
                head: ["Component", "Max", "Weight", "Aggregation", "Edit"],
                nounPlural: "components",
                acts: [
                  {
                    label: "Add a component",
                    drawer: componentDrawer(null, subjectSectionOptions, sharedTotal),
                  },
                ],
                rows: shared.map((component) => ({
                  cells: [
                    nameCell(
                      component.name,
                      componentLabel(component.type).toLowerCase() === component.name.toLowerCase()
                        ? undefined
                        : componentLabel(component.type),
                    ),
                    text(round1(component.maxScore), { mono: true }),
                    text(`${round1(component.weight)}%`, { mono: true }),
                    text("Sum across term"),
                    {
                      kind: "action" as const,
                      label: "Edit",
                      drawer: componentDrawer(component, subjectSectionOptions, sharedTotal),
                    },
                  ],
                  keywords: `${component.name} ${component.code ?? ""}`,
                })),
                foot: identical
                  ? `Identical across all ${sectionNames.length} sections · every section totals 100.`
                  : `Shown for ${sectionLabel(sectionNames[0] ?? null)}. Component sets differ by section.`,
              }
            : {
                type: "note",
                tone: "attention",
                title: "No assessment components are set",
                body: "A term cannot become one number until components and their weights exist.",
              },
          bands.length
            ? {
                type: "table",
                title: "Grading bands",
                tag: "Contiguous",
                tagTone: "positive",
                meta: `${bands.length} bands · ${scheme?.name ?? ""}`,
                head: ["Grade", "Range", "Label", "Points", "Edit"],
                nounPlural: "bands",
                acts: [{ label: "Add a band", drawer: bandDrawer(scheme, null, bands.length) }],
                rows: bands.map((band) => ({
                  cells: [
                    text(band.label, { strong: true }),
                    text(bandRange(band)),
                    text(band.remark ?? "—"),
                    text(String(band.order), { mono: true }),
                    {
                      kind: "action" as const,
                      label: "Edit",
                      drawer: bandDrawer(scheme, band, bands.length),
                    },
                  ],
                  keywords: `${band.label} ${band.remark ?? ""}`,
                })),
                foot: `Pass mark ${scheme?.passMark ?? "—"} · ranking ${
                  scheme?.rankingEnabled ? "on" : "off"
                }.`,
              }
            : {
                type: "note",
                tone: "attention",
                title: "No grading bands are set",
                body: "Without bands a score stays a number and a report card has nothing to call it.",
              },
        ],
      },
      {
        cols: "1fr 1.1fr",
        panels: [
          {
            type: "note",
            tone: "withheld",
            icon: LOCK_ICON,
            title: "Components, maximums and weights cannot change for a term already scored",
            body: sectionsOffTotal.length
              ? `${sectionsOffTotal.length} section(s) do not total 100, so the framework cannot be locked for the term until they do.`
              : "Scores exist against this framework. Changing a weight now would silently restate results a parent has already received, so a change takes effect from the next term.",
          },
          {
            type: "note",
            tone: "progress",
            icon: REPORT_ICON,
            title: "The report card layer is owned by Report Cards, not this module",
            body: "What a parent receives — behavioural domains, position by arm and class, the printed layout — is set there and previewed against real scores before it saves.",
            acts: [{ label: "Open Report Cards", href: "/report-cards/templates" }],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: "Subject catalogue",
            tag: `${subjects.filter((item) => item.isCore).length} core · ${electiveCount} elective`,
            tagTone: unsectioned ? "attention" : "neutral",
            sub: "Filter to a section or a stream to see exactly what that part of the school offers.",
            meta: `${subjects.length} subjects · ${subjectSections.length} sections · ${
              departments.length
            } departments · ${subjectStreams.length} streams`,
            search: "Find a subject by name, code, department or stream",
            filters: [
              { label: "Section", value: "All", options: ["All", ...subjectSections], column: 1 },
              {
                label: "Department",
                value: "All",
                options: ["All", ...subjectDepartments],
                column: 3,
              },
              { label: "Kind", value: "All", options: ["All", "Core", "Elective"], column: 4 },
              { label: "Stream", value: "All", options: ["All", ...subjectStreams], column: 5 },
            ],
            acts: [
              {
                label: "Add a subject",
                drawer: subjectDrawer(null, subjectSectionOptions, departments),
              },
            ],
            head: ["Subject", "Section", "Class levels", "Department", "Kind", "Stream", "", ""],
            noun: "subject",
            nounPlural: "subjects",
            per: 12,
            rows: subjectRows,
            foot: unsectioned
              ? `${unsectioned} subject(s) sit in no section, so no class level offers them.`
              : "Every subject names the section and the class levels it is taught at. Open one for its certificate codes and timetable needs.",
          },
        ],
      },
    ],
  };
}

/**
 * The curriculum sub-page's own loader.
 *
 * `in-force` is the configuration this school is actually running, which is
 * assembled from the live records rather than stored as a row. Any other id is
 * a curriculum the builder wrote, and it is read back from its own record.
 */
export async function curriculumDetail(id: string): Promise<TabContent | null> {
  const [school, subjects, levels] = await Promise.all([
    apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`),
    apiGet<{ records: SubjectRecord[] }>(`${CONFIG}/subjects`),
    apiGet<{ records: ClassLevelRecord[] }>(`${CONFIG}/class-levels`),
  ]);
  if (!school?.record) return null;

  const [schemes, components, departments] = await Promise.all([
    apiGet<GradingScheme[]>("/api/v1/academics/grading-schemes").catch(() => [] as GradingScheme[]),
    apiGet<SectionComponent[]>("/api/v1/academics/section-assessment-components").catch(
      () => [] as SectionComponent[],
    ),
    apiGet<{ records: DepartmentRecord[] }>(`${CONFIG}/departments`).catch(() => ({
      records: [] as DepartmentRecord[],
    })),
  ]);

  const content = curriculumDetailContent(
    school.record,
    subjects?.records ?? [],
    levels?.records ?? [],
    schemes ?? [],
    components ?? [],
    departments?.records ?? [],
  );

  if (id === "in-force") return content;

  // A built curriculum is a record of its own; its name and state replace the
  // live heading, while the layers below still describe what is in force.
  const built = await apiGet<{ records: CurriculumRecord[] }>(`${CONFIG}/curricula`).catch(() => ({
    records: [] as CurriculumRecord[],
  }));
  const record = (built?.records ?? []).find((item) => item.id === id);
  if (!record) return null;

  const draft = record.status !== "ACTIVE";
  return {
    ...content,
    title: record.name,
    desc: record.description || "Built here. Nothing it sets is in force until you say so.",
    launchers: [
      { label: "Back to all curricula", href: "/school-configuration/curriculum" },
      ...(draft
        ? [
            {
              label: "Put this curriculum in force",
              drawer: {
                mode: "commit" as const,
                kicker: "Draft curriculum",
                title: `Put \u201c${record.name}\u201d in force`,
                sub: "This writes the grading bands and every section's assessment components.",
                commitLabel: "Put it in force",
                commitNote:
                  "A curriculum in force cannot be swapped mid-term. If scores have already been submitted this is refused, and it takes effect from the next term instead.",
                commitDone: `${record.name} is in force`,
                commitDoneBody:
                  "The grading bands and assessment components now match this curriculum. Results already issued keep the framework they were issued under.",
                submit: {
                  endpoint: `/api/v1/configuration/curricula/${record.id}/apply`,
                  method: "POST" as const,
                  body: { effectiveFrom: "NEXT_TERM" },
                },
              },
            },
          ]
        : []),
    ],
  };
}

const ALLOCATION_CATEGORY_OPTIONS = [
  "Books",
  "Stationery",
  "Uniform",
  "Boarding kit",
  "Digital",
  "Practical and laboratory",
  "Sports",
  "Other",
];
const ALLOCATION_SOURCES = [
  "Any shop — the school sets the standard only",
  "Any stationer",
  "Any bookseller",
  "Any shoe shop",
  "School store only",
  "School bookshop, or any bookseller",
  "Named supplier",
];
const NEEDED_OPTIONS = [
  "Required — every child must have it",
  "Optional — a family may skip it",
  "Boarders only",
  "Day students only",
];
const NEEDED_CODES: Record<string, string> = {
  [NEEDED_OPTIONS[0]]: "REQUIRED",
  [NEEDED_OPTIONS[1]]: "OPTIONAL",
  [NEEDED_OPTIONS[2]]: "BOARDERS",
  [NEEDED_OPTIONS[3]]: "DAY",
};
const SEND_PRICES = [
  "Yes — with a total per category",
  "Yes — totals only, no line prices",
  "No — items only",
];
/** Only channels that cost a school nothing: SMS and WhatsApp spend credits, and are sent from Communication Center. */
const SEND_CHANNELS: Record<string, string> = {
  "Guardian app \u00b7 free": "IN_APP",
  Email: "EMAIL",
};
const SEND_DEADLINES = [
  "Resumption day",
  "One week after resumption",
  "Two weeks after resumption",
  "No deadline",
];
const CATEGORY_TONE: Record<string, PanelTone> = {
  Books: "progress",
  Stationery: "neutral",
  Uniform: "positive",
  "Boarding kit": "attention",
  Digital: "submitted",
};

const ALLOCATION_ROOT = "/school-configuration/allocations";

function listStateOf(structure: FeeStructure): { label: string; tone: PanelTone } {
  if (structure.listState === "DRAFT") return { label: "Draft", tone: "progress" };
  if (structure.listState === "ARCHIVED") return { label: "Archived", tone: "neutral" };
  return { label: "Published", tone: "positive" };
}

function itemCategory(item: FeeItem): string {
  return item.category ?? ALLOCATION_CATEGORY_FOR[item.componentType] ?? componentLabel(item.componentType);
}

function neededOf(item: FeeItem): string {
  if (item.audience === "BOARDERS") return "Boarders only";
  if (item.audience === "DAY") return "Day students only";
  return item.isOptional ? "Optional" : "Required";
}

function neededOption(item: FeeItem): string {
  if (item.audience === "BOARDERS") return NEEDED_OPTIONS[2];
  if (item.audience === "DAY") return NEEDED_OPTIONS[3];
  return item.isOptional ? NEEDED_OPTIONS[1] : NEEDED_OPTIONS[0];
}

function itemFields(item: FeeItem | null): FormField[] {
  const category = item ? itemCategory(item) : "Books";
  const source = item?.source ?? ALLOCATION_SOURCES[0];
  return [
    {
      label: "Category",
      kind: "select",
      value: category,
      options: withCurrent(ALLOCATION_CATEGORY_OPTIONS, category),
      required: true,
    },
    { label: "Item", kind: "text", value: item?.label ?? "", placeholder: "e.g. Scientific calculator", required: true },
    {
      label: "What it is",
      kind: "text",
      value: item?.note ?? "",
      placeholder: "One line a parent can act on — e.g. “Non-programmable only, examination rule”",
      optional: true,
      span: 2,
    },
    {
      label: "Quantity per child",
      kind: "text",
      value: String(item?.quantity ?? 1),
      unit: "per child",
      required: true,
    },
    {
      label: "Unit price",
      kind: "text",
      value: item ? String(item.unitAmount ?? item.amount) : "",
      placeholder: "6500",
      unit: "₦",
      required: true,
      hint: "Leave the price out of the print if you would rather families shop around",
    },
    {
      label: "Where a family may buy it",
      kind: "select",
      value: source,
      options: withCurrent(ALLOCATION_SOURCES, source),
      required: true,
      span: 2,
      hint: "School store only means the family has no choice — use it sparingly",
    },
    {
      label: "Supplier",
      kind: "text",
      value: item?.supplier ?? "",
      placeholder: "Only if you named one above",
      optional: true,
    },
    {
      label: "Needed",
      kind: "select",
      value: item ? neededOption(item) : NEEDED_OPTIONS[0],
      options: NEEDED_OPTIONS,
      required: true,
    },
    {
      label: "Show this item’s price on the printed sheet",
      kind: "toggle",
      on: item?.showPrice ?? true,
      span: 2,
      onLabel: "Price shown",
      offLabel: "Item only — no price",
    },
  ];
}

const ITEM_MAP = {
  Category: "category",
  Item: "label",
  "What it is": "note",
  "Quantity per child": "quantity",
  "Unit price": "unitAmount",
  "Where a family may buy it": "source",
  Supplier: "supplier",
  Needed: "needed",
  "Show this item’s price on the printed sheet": "showPrice",
};

function addItemDrawer(structure: FeeStructure): DrawerSpec {
  return {
    mode: "form",
    kicker: structure.name,
    title: "Add an item to an allocation",
    commitLabel: "Add the item",
    commitDone: "Item added",
    commitDoneBody: "It is on the list and counted in the totals. Reprint the sheet when you are done adding.",
    reviewNote:
      "An item a family must buy from the school should say so — it is the only thing they cannot shop around for.",
    fields: itemFields(null),
    submit: {
      endpoint: `/api/v1/finance/fee-structures/${structure.id}/items`,
      method: "POST",
      map: ITEM_MAP,
      encode: { Needed: NEEDED_CODES },
    },
  };
}

function editItemDrawer(structure: FeeStructure, item: FeeItem): DrawerSpec {
  return {
    mode: "edit",
    kicker: structure.name,
    title: item.label,
    commitDone: `${item.label} saved`,
    commitDoneBody: "Both the previous and the new values are kept on the record.",
    fields: itemFields(item),
    submit: {
      endpoint: `/api/v1/finance/fee-structures/${structure.id}/items/${item.id}`,
      method: "PATCH",
      map: ITEM_MAP,
      encode: { Needed: NEEDED_CODES },
      reasonKey: "reason",
      reasonRequired: true,
    },
    remove: {
      endpoint: `/api/v1/finance/fee-structures/${structure.id}/items/${item.id}`,
      noun: "item",
      warn: `“${item.label}” will come off this list and out of its totals. Anything already printed keeps it.`,
    },
  };
}

function sendDrawer(structure: FeeStructure): DrawerSpec {
  const who = structure.className ?? "every class";
  return {
    mode: "form",
    kicker: structure.name,
    title: "Send an allocation list to guardians",
    commitLabel: "Send it",
    commitDone: "Allocation list sent",
    commitDoneBody:
      "It is with the guardians now. The send is in the audit log, and a family only ever receives the list for their own child’s class.",
    reviewNote: "A family only ever receives the list for their own child’s class.",
    fields: [
      { label: "Goes to", kind: "static", value: `Guardians with a child in ${who}`, span: 2 },
      {
        label: "Show prices",
        kind: "select",
        value: SEND_PRICES[0],
        options: SEND_PRICES,
        required: true,
        span: 2,
        hint: "A list without prices is for families who buy where they like",
      },
      {
        label: "Send through",
        kind: "select",
        value: "Guardian app · free",
        options: Object.keys(SEND_CHANNELS),
        required: true,
      },
      {
        label: "Deadline to have everything",
        kind: "select",
        value: SEND_DEADLINES[0],
        options: SEND_DEADLINES,
        required: true,
        hint: "Printed at the foot of the sheet",
      },
      {
        label: "A note to go with it",
        kind: "area",
        value: structure.familyNote ?? "",
        optional: true,
        span: 2,
        placeholder: "Optional — e.g. “Books must be covered and named.”",
      },
    ],
    submit: {
      endpoint: `/api/v1/finance/fee-structures/${structure.id}/send`,
      method: "POST",
      map: {
        "Show prices": "prices",
        "Send through": "channel",
        "Deadline to have everything": "deadline",
        "A note to go with it": "note",
      },
      encode: { "Send through": SEND_CHANNELS },
    },
  };
}

function stateDrawer(structure: FeeStructure, to: "PUBLISHED" | "DRAFT"): DrawerSpec {
  const items = structure.items.filter((item) => item.isActive);
  const publishing = to === "PUBLISHED";
  return {
    mode: "commit",
    kicker: `${structure.className ?? "Every class"} · ${structure.term ?? "this term"}`,
    title: publishing ? `Publish ${structure.name}` : `Reopen ${structure.name} as a draft`,
    commitLabel: publishing ? "Publish it" : "Reopen it",
    commitDone: publishing ? `${structure.name} published` : `${structure.name} is a draft again`,
    commitDoneBody: publishing
      ? `Families with a child in ${structure.className ?? "every class"} can have it now, and it is open for printing.`
      : "It is yours alone again. Nobody is billed from it until it is published.",
    facts: [
      ["Goes to", `Every guardian with a child in ${structure.className ?? "every class"}`, "Once it is sent"],
      ["Items", String(items.length)],
      ["Required total", naira(requiredTotal(structure)), "What a family plans around"],
      ["Printing", publishing ? "Opens for printing, with or without prices" : "Closed until it is published"],
    ] as PanelFact[],
    submit: {
      endpoint: `/api/v1/finance/fee-structures/${structure.id}/state`,
      method: "PATCH",
      body: { listState: to },
    },
  };
}

function printHref(structure: FeeStructure, prices: boolean): string {
  return `/print/allocation/${structure.id}?prices=${prices ? 1 : 0}`;
}

/**
 * M02 · Allocations, in the mockup's shape: the figures for this term, then one
 * table of every list with who owns it and whether it is published, then the
 * standing note on what a list is.
 */
function allocationsTab(
  structures: FeeStructure[],
  classCount: number,
  currentTerm: string | null,
  classNames: string[],
): TabContent {
  const lists = structures.filter((item) => item.items.length > 0);
  const inTerm = currentTerm ? lists.filter((item) => item.term === currentTerm) : lists;
  const scoped = inTerm.length ? inTerm : lists;
  const published = scoped.filter((item) => item.listState !== "DRAFT" && item.listState !== "ARCHIVED" && item.isActive);
  const drafts = scoped.filter((item) => item.listState === "DRAFT");
  const covered = new Set(published.map((item) => item.className).filter(Boolean));
  const missing = Math.max(0, classCount - covered.size);
  const priced = published.length ? published : scoped;
  const cheapest = priced.slice().sort((a, b) => requiredTotal(a) - requiredTotal(b))[0];
  const dearest = priced.slice().sort((a, b) => requiredTotal(b) - requiredTotal(a))[0];
  const terms = Array.from(new Set(lists.map((item) => item.term).filter((term): term is string => Boolean(term))));

  const sendEveryList: DrawerSpec | null = published[0]
    ? {
        mode: "form",
        kicker: currentTerm ?? "This term",
        title: "Send this term’s lists to guardians",
        commitLabel: "Send them",
        commitDone: "Lists sent",
        commitDoneBody: "Each guardian receives only the list for their own child’s class.",
        reviewNote: "One announcement per published list, each addressed to that class’s families.",
        fields: [
          {
            label: "Lists",
            kind: "static",
            value: `${published.length} published · ${published.map((item) => item.className ?? "every class").join(", ")}`,
            span: 2,
          },
          {
            label: "Show prices",
            kind: "select",
            value: SEND_PRICES[0],
            options: SEND_PRICES,
            required: true,
            span: 2,
          },
          {
            label: "Send through",
            kind: "select",
            value: "Guardian app · free",
            options: Object.keys(SEND_CHANNELS),
            required: true,
          },
          {
            label: "Deadline to have everything",
            kind: "select",
            value: SEND_DEADLINES[0],
            options: SEND_DEADLINES,
            required: true,
          },
        ],
        submit: {
          endpoint: "/api/v1/finance/fee-structures/send-published",
          method: "POST",
          body: { term: currentTerm },
          map: {
            "Show prices": "prices",
            "Send through": "channel",
            "Deadline to have everything": "deadline",
          },
          encode: { "Send through": SEND_CHANNELS },
        },
      }
    : null;

  return {
    title: "Allocations",
    desc: "What each class needs for a term, priced and printable for families.",
    primary: { label: "Create an allocation", href: `${ALLOCATION_ROOT}/build` },
    launchers: [
      ...(published[0] ? [{ label: "Print every published list", href: "/print/allocation/all?prices=0" }] : []),
      ...(sendEveryList ? [{ label: "Send this term’s lists to guardians", drawer: sendEveryList }] : []),
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "This term",
            sub: currentTerm ?? undefined,
            per: 4,
            cards: [
              {
                label: "Lists published",
                value: String(published.length),
                unit: `of ${scoped.length}`,
                sub: drafts.length ? `${drafts.length} still in draft` : scoped.length ? "Every list published" : "Nothing created yet",
                tone: drafts.length || !scoped.length ? "attention" : "positive",
              },
              {
                label: "Classes with no list",
                value: String(missing),
                sub: classCount
                  ? missing
                    ? "Families there have been told nothing"
                    : `All ${classCount} classes covered`
                  : "No classes are set up",
                tone: missing ? "attention" : "positive",
              },
              {
                label: "Cheapest required list",
                value: cheapest ? naira(requiredTotal(cheapest)) : "—",
                sub: cheapest?.className ?? cheapest?.name ?? "—",
                tone: "neutral",
              },
              {
                label: "Dearest required list",
                value: dearest ? naira(requiredTotal(dearest)) : "—",
                sub: dearest?.className ?? dearest?.name ?? "—",
                tone: "neutral",
              },
            ],
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          lists.length
            ? {
                type: "table",
                title: "All allocations",
                tag: `${published.length} published`,
                tagTone: "positive",
                sub: "One list per class per term. Open any to price it, edit it, or print it for the families.",
                meta: `${lists.length} list${lists.length === 1 ? "" : "s"} · across ${terms.length || 1} term${terms.length === 1 ? "" : "s"}`,
                search: "Find a list by name or class",
                filters: [
                  { label: "Term", value: "All", options: ["All", ...terms], column: 2 },
                  { label: "Class", value: "All", options: ["All", ...classNames], column: 1 },
                  { label: "State", value: "All", options: ["All", "Published", "Draft", "Archived"], column: 7 },
                ],
                acts: [{ label: "Create an allocation", primary: true, href: `${ALLOCATION_ROOT}/build` }],
                head: ["Allocation", "Class", "Term", "Items", "Required", "Optional", "Owner", "State", ""],
                noun: "allocation",
                nounPlural: "allocations",
                per: 10,
                rows: lists.map((structure) => {
                  const state = listStateOf(structure);
                  const categories = Array.from(new Set(structure.items.map(itemCategory))).join(" · ");
                  return {
                    cells: [
                      nameCell(structure.name, categories || undefined, { avatar: false }),
                      text(structure.className ?? "Every class"),
                      text(structure.term ?? structure.recurrence.toLowerCase()),
                      text(String(structure.items.length), { mono: true }),
                      text(naira(requiredTotal(structure)), { mono: true, strong: true }),
                      text(optionalTotal(structure) ? naira(optionalTotal(structure)) : "—", { mono: true }),
                      structure.ownerName
                        ? nameCell(structure.ownerName, "Owns this list", { avatar: false })
                        : text("No owner named", { tone: "attention" }),
                      pill(state.label, state.tone),
                      { kind: "action" as const, label: "Open", href: `${ALLOCATION_ROOT}/${structure.id}` },
                    ],
                    keywords: `${structure.name} ${structure.term ?? ""} ${structure.className ?? ""} ${structure.ownerName ?? ""}`,
                  };
                }),
              }
            : {
                type: "note",
                tone: "attention",
                title: "No allocation list exists",
                body: "Nothing can be printed for a family until a list is created and priced.",
                acts: [{ label: "Create an allocation", href: `${ALLOCATION_ROOT}/build` }],
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "facts",
            title: "A list is a standard the school sets, not a shop",
            sub: "How allocations work",
            per: 1,
            facts: [
              ["Where a family buys", "Anywhere the source column allows", "Only School store only removes the choice"],
              ["What the price means", "What the school says it should cost", "Not what the school charges"],
              ["Published", "In the guardian app and open for printing"],
              ["Archived", "Kept exactly as issued", "So a family asking what they were told last term gets the truth"],
            ] as PanelFact[],
          },
        ],
      },
    ],
  };
}

/**
 * M02 · one allocation, opened from the list: the figures, every item with where
 * a family may buy it, and what the list costs by category. Items are added,
 * edited and removed here, and the list is published, printed and sent from here.
 */
export function allocationDetailContent(structure: FeeStructure): TabContent {
  const items = structure.items.filter((item) => item.isActive);
  const required = requiredTotal(structure);
  const optional = optionalTotal(structure);
  const state = listStateOf(structure);
  const live = structure.listState !== "DRAFT" && structure.listState !== "ARCHIVED" && structure.isActive;
  const categories = Array.from(new Set(items.map(itemCategory)));
  const storeOnly = items.filter((item) => /school store only/i.test(item.source ?? ""));
  const storeOnlyTotal = storeOnly.reduce((sum, item) => sum + item.amount, 0);
  const sources = Array.from(new Set(items.map((item) => item.source).filter((source): source is string => Boolean(source))));

  return {
    title: structure.name,
    desc: `${structure.className ?? "Every class"} · ${structure.term ?? "this term"} · ${items.length} item${items.length === 1 ? "" : "s"} across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`,
    primary: { label: "Print with prices", href: printHref(structure, true) },
    launchers: [
      { label: "Print without prices", href: printHref(structure, false) },
      { label: "Send it to the guardians", drawer: sendDrawer(structure) },
      { label: "Back to all allocations", href: ALLOCATION_ROOT },
    ],
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "kpi",
            title: "This allocation",
            sub: "Prices are what the school states today. A family may buy anywhere the source column allows.",
            per: 5,
            cards: [
              { label: "Required", value: naira(required), sub: `${items.filter((item) => !item.isOptional).length} ${items.filter((item) => !item.isOptional).length === 1 ? "item" : "items"} every child must have`, tone: "neutral" },
              { label: "Optional", value: optional ? naira(optional) : "—", sub: `${items.filter((item) => item.isOptional).length} ${items.filter((item) => item.isOptional).length === 1 ? "item" : "items"} a family may skip`, tone: "progress" },
              { label: "Full list", value: naira(structure.total), sub: "If a family took everything", tone: "neutral" },
              { label: "Buy at school", value: naira(storeOnlyTotal), sub: `${storeOnly.length} item${storeOnly.length === 1 ? "" : "s"} only the school sells`, tone: "attention" },
              {
                label: "State",
                value: state.label,
                sub: live ? "Families can see it" : structure.listState === "DRAFT" ? "Not yet sent to anyone" : "Kept for the record",
                tone: live ? "positive" : structure.listState === "DRAFT" ? "progress" : "neutral",
              },
            ],
          },
        ],
      },
      ...(live
        ? []
        : [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "progress" as const,
                  title:
                    structure.listState === "DRAFT"
                      ? "This list has not been published"
                      : "This list belongs to a term that has closed",
                  body:
                    structure.listState === "DRAFT"
                      ? "No family can see it and nothing has been printed. Publish it to put it in the guardian app and open it for printing."
                      : "It is kept exactly as it was issued, so a family asking what they were told last term gets the truth. Reopen it as a draft to use it again.",
                  acts:
                    structure.listState === "DRAFT"
                      ? [{ label: "Publish this list", drawer: stateDrawer(structure, "PUBLISHED") }]
                      : [{ label: "Reopen as a draft", drawer: stateDrawer(structure, "DRAFT") }],
                },
              ],
            },
          ]),
      {
        cols: "1fr",
        panels: [
          items.length
            ? {
                type: "table",
                title: "Items on this list",
                tag: `${items.length} items`,
                tagTone: "neutral",
                sub: "What it costs, how many, and where a family may buy it.",
                meta: categories.join(" · "),
                search: "Find an item",
                filters: [
                  { label: "Category", value: "All", options: ["All", ...categories], column: 0 },
                  { label: "Needed", value: "All", options: ["All", "Required", "Optional", "Boarders only", "Day students only"], column: 7 },
                  { label: "Source", value: "All", options: ["All", ...sources], column: 3 },
                ],
                acts: [
                  { label: "Print without prices", href: printHref(structure, false) },
                  { label: "Print with prices", href: printHref(structure, true) },
                  { label: "Add an item", primary: true, drawer: addItemDrawer(structure) },
                ],
                head: ["Category", "Item", "What it is", "Where to buy it", "Qty", "Unit price", "Line total", "Needed", ""],
                noun: "item",
                nounPlural: "items",
                per: 12,
                rows: items.map((item) => ({
                  cells: [
                    pill(itemCategory(item), CATEGORY_TONE[itemCategory(item)] ?? "neutral"),
                    text(item.label, { strong: true }),
                    text(item.note ?? "—"),
                    text(item.source ?? "Not stated", { strong: /school store only/i.test(item.source ?? "") }),
                    text(String(item.quantity ?? 1), { mono: true, strong: true }),
                    text(naira(item.unitAmount ?? item.amount), { mono: true, strong: true }),
                    text(naira(item.amount), { mono: true, strong: true }),
                    pill(neededOf(item), neededOf(item) === "Required" ? "positive" : "neutral"),
                    { kind: "action" as const, label: "Edit", drawer: editItemDrawer(structure, item) },
                  ],
                  keywords: `${item.label} ${itemCategory(item)} ${item.source ?? ""}`,
                })),
              }
            : {
                type: "note",
                tone: "attention",
                title: "This list has no items",
                body: "Nothing can be printed for a family until the list is priced.",
                acts: [{ label: "Add an item", drawer: addItemDrawer(structure) }],
              },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "bars",
            title: "What the list costs, by category",
            sub: "Required items only. This is the number a family plans around.",
            rows: categories.map((category) => {
              const value = items
                .filter((item) => !item.isOptional && itemCategory(item) === category)
                .reduce((sum, item) => sum + item.amount, 0);
              return {
                label: category,
                value,
                display: naira(value),
                tone: CATEGORY_TONE[category] ?? "neutral",
              };
            }),
          },
        ],
      },
    ],
  };
}

/** The allocation sub-page's loader. */
export async function allocationDetail(id: string): Promise<TabContent | null> {
  const structures = await apiGet<FeeStructure[]>("/api/v1/finance/fee-structures").catch(
    () => [] as FeeStructure[],
  );
  const structure = (structures ?? []).find((item) => item.id === id);
  return structure ? allocationDetailContent(structure) : null;
}

type ClassRoomRecord = { id: string; name: string; arm: string | null; level?: string | null };

/**
 * What the allocation builder needs to open: the classes a list can belong to,
 * the terms it can run in, and the items this school already prices — which is
 * the only honest "starter catalogue" available, since nothing ships one.
 */
export async function allocationBuilderData() {
  const [classPayload, sessions, structures] = await Promise.all([
    apiGet<Record<string, unknown>>("/api/v1/timetable/classes").catch(() => null),
    apiGet<{ records: SessionRecord[] }>(`${CONFIG}/sessions-terms`).catch(() => ({
      records: [] as SessionRecord[],
    })),
    apiGet<FeeStructure[]>("/api/v1/finance/fee-structures").catch(() => [] as FeeStructure[]),
  ]);

  // The classes resource groups rooms by category; the builder wants them flat.
  const grouped = ((classPayload as { data?: Record<string, ClassRoomRecord[]> } | null)?.data ??
    {}) as Record<string, ClassRoomRecord[]>;
  const classes = Object.values(grouped)
    .flat()
    .filter((room): room is ClassRoomRecord => Boolean(room?.id && room?.name))
    .map((room) => ({ id: room.id, name: room.name }));

  const terms = (sessions?.records ?? []).flatMap((session) =>
    session.terms.map((term) => ({ id: term.id, name: term.name, sessionName: session.name })),
  );

  /** The school's own priced lines, offered as a starting point. */
  const seen = new Set<string>();
  const catalogue = (structures ?? [])
    .flatMap((structure) => structure.items)
    .filter((item) => item.isActive && !seen.has(item.label) && seen.add(item.label))
    .map((item) => ({
      cat: ALLOCATION_CATEGORY_FOR[item.componentType] ?? "Stationery",
      item: item.label,
      note: "",
      qty: 1,
      unit: item.amount,
      req: !item.isOptional,
    }));

  return { classes, terms, catalogue };
}

/** The reverse of the builder's category pairing, for reading a priced line back. */
const ALLOCATION_CATEGORY_FOR: Record<string, string> = {
  BOOKS: "Books",
  UNIFORM: "Uniform",
  HOSTEL: "Boarding kit",
  ICT_FEE: "Digital",
  TRANSPORT: "Stationery",
  TUITION: "Stationery",
  DEVELOPMENT_LEVY: "Stationery",
  EXAM_FEE: "Practical and laboratory",
  PTA_FEE: "Stationery",
  OTHER: "Stationery",
};

/* ─────────────────────────── entry ─────────────────────────── */


type PolicyItem = {
  id: string;
  code: string | null;
  data: { values?: PolicyValues; changedAt?: string } | null;
};

/**
 * M02 · Policies — the rules that make the product behave like this school.
 *
 * They live in ConfigurationItem, which the configuration module has always
 * served. What the tab adds is which areas are *unset*: a policy area with no
 * rule is not a school with no opinion, it is the product falling back to a
 * default nobody here chose.
 */
/**
 * M02 · Policies, in the mockup's shape: two tables grouped by what the rules
 * govern, each stating what a setting changes rather than what it is called
 * internally, then a note on what the product will not do.
 */

type FeeItem = {
  id: string;
  label: string;
  componentType: string;
  amount: number;
  /** How many a family buys, and what one costs. */
  quantity: number | null;
  unitAmount: number | null;
  note: string | null;
  /** The school's own grouping on a printed list. */
  category: string | null;
  source: string | null;
  supplier: string | null;
  /** EVERYONE, BOARDERS or DAY. */
  audience: string;
  showPrice: boolean;
  isOptional: boolean;
  isActive: boolean;
};

type FeeStructure = {
  id: string;
  name: string;
  currency: string;
  session: string | null;
  term: string | null;
  className: string | null;
  recurrence: string;
  isOneTime: boolean;
  isActive: boolean;
  /** DRAFT, PUBLISHED or ARCHIVED. */
  listState: string;
  ownerName: string | null;
  familyNote: string | null;
  total: number;
  items: FeeItem[];
};

function naira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function componentLabel(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function requiredTotal(structure: FeeStructure): number {
  return structure.items
    .filter((item) => item.isActive && !item.isOptional)
    .reduce((sum, item) => sum + item.amount, 0);
}

function optionalTotal(structure: FeeStructure): number {
  return structure.items
    .filter((item) => item.isActive && item.isOptional)
    .reduce((sum, item) => sum + item.amount, 0);
}


function policyFields(definition: PolicyDefinition, values: PolicyValues): FormField[] {
  return definition.fields.map((field) => {
    const given = values[field.key];
    if (field.kind === "checks") {
      return {
        label: field.label,
        kind: "checks" as const,
        checked: Array.isArray(given) ? given : [],
        options: field.options,
        hint: field.hint,
        span: 2 as const,
      };
    }
    const value = typeof given === "string" ? given : field.options[0];
    return {
      label: field.label,
      kind: "select" as const,
      value,
      options: withCurrent(field.options, value),
      required: true,
      hint: field.hint,
      span: 2 as const,
    };
  });
}

function editPolicyDrawer(definition: PolicyDefinition, values: PolicyValues, panel: string): DrawerSpec {
  return {
    mode: "edit",
    kicker: panel,
    title: definition.label,
    commitDone: `${definition.label} saved`,
    commitDoneBody: "Both the previous and the new value are kept on the record, under your name.",
    fields: policyFields(definition, values),
    submit: {
      endpoint: `${CONFIG}/school-policies/${definition.code}`,
      method: "PATCH",
      map: Object.fromEntries(definition.fields.map((field) => [field.label, field.key])),
      reasonKey: "reason",
      reasonRequired: true,
    },
  };
}

/**
 * M02 · Policies, in the mockup's shape: two tables grouped by what the rules
 * govern, each stating what a setting changes rather than what it is called
 * internally, then a note on what the product will not do.
 *
 * A setting nobody here has chosen shows the product's default in regular weight;
 * one the school has set is in bold. Each row saves on its own, in its own modal.
 */
function policiesTab(saved: PolicyItem[], country: string | null): TabContent {
  const stored = new Map(saved.map((item) => [item.code ?? "", item.data?.values]));
  const overrides = approvalRoutes.filter((route) => route.source === "School override").length;

  const rowFor = (definition: PolicyDefinition, panel: string): TableRow => {
    const set = stored.get(definition.code);
    const values: PolicyValues = { ...definition.defaults, ...(set ?? {}) };
    return {
      cells: [
        nameCell(definition.label, policySub(definition, values), { avatar: false }),
        text(summarisePolicy(definition.code, values), { strong: Boolean(set) }),
        text(definition.changes, { tone: "neutral" }),
        {
          kind: "action" as const,
          label: "Edit",
          drawer: editPolicyDrawer(definition, values, panel),
        },
      ],
      keywords: `${definition.label} ${definition.sub}`,
    };
  };

  const academic = POLICY_DEFINITIONS.filter((item) => item.area === "academic");
  const family = POLICY_DEFINITIONS.filter((item) => item.area === "family");
  const academicTitle = "Academic and attendance policy";
  const familyTitle = "Family, finance and communication policy";

  const routingRow: TableRow = {
    cells: [
      nameCell("Approval routing overrides", "School-specific routes", { avatar: false }),
      text(overrides ? `${overrides} override${overrides === 1 ? "" : "s"} in force` : "No overrides — defaults apply", { strong: overrides > 0 }),
      text("Configured in Approvals & Workflow · Workflow; shown here for visibility."),
      { kind: "action" as const, label: "Open routing", href: "/approvals-workflow/workflow" },
    ],
    keywords: "approval routing overrides routes",
  };

  // The mockup places the routing row fifth among the family settings.
  const familyRows = family.map((item) => rowFor(item, familyTitle));
  familyRows.splice(4, 0, routingRow);

  return {
    title: "Policies",
    desc: "The rules that make Nooria behave like this school.",
    rows: [
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: academicTitle,
            sub: "Each setting states what it changes, not what it is called internally.",
            head: ["Setting", "Value", "What it changes", "Edit"],
            noun: "setting",
            nounPlural: "settings",
            rows: academic.map((item) => rowFor(item, academicTitle)),
          },
        ],
      },
      {
        cols: "1fr",
        panels: [
          {
            type: "table",
            title: familyTitle,
            head: ["Setting", "Value", "What it changes", "Edit"],
            noun: "setting",
            nounPlural: "settings",
            rows: familyRows,
            foot: "A value in regular weight is the product's default \u2014 nobody here has chosen it yet. These settings are recorded for the school; each module applies the ones it enforces.",
          },
        ],
      },
      ...(country === "Nigeria"
        ? [
            {
              cols: "1fr",
              panels: [
                {
                  type: "note" as const,
                  tone: "offline" as const,
                  icon: LOCK_ICON,
                  title: "Fee-linked result access is unavailable in Nigeria",
                  body: "Withholding a child\u2019s result for unpaid fees is not permitted under the country configuration for Nigeria, so this school cannot enable it.",
                },
              ],
            },
          ]
        : []),
    ],
  };
}

export async function schoolConfigurationLiveTab(
  tabSlug: string,
): Promise<TabContent | null | undefined> {
  if (tabSlug === "profile") {
    const payload = await apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`);
    if (!payload?.record) return undefined;
    const branding = await apiGet<BrandingVersion[]>("/api/v1/configuration/branding-versions").catch(
      () => [] as BrandingVersion[],
    );
    return profileTab(payload.record, branding ?? [], await loadSample());
  }

  if (tabSlug === "calendar") {
    const [terms, events] = await Promise.all([
      apiGet<{ records: SessionRecord[] }>(`${CONFIG}/sessions-terms`),
      apiGet<{ records: CalendarRecord[] }>(`${CONFIG}/school-calendar`),
    ]);
    const [components, windows] = await Promise.all([
      apiGet<AssessmentComponentRecord[]>("/api/v1/academics/assessments").catch(
        () => [] as AssessmentComponentRecord[],
      ),
      apiGet<{ records: AssessmentWindowRecord[] }>(`${CONFIG}/assessment-windows`).catch(
        () => ({ records: [] as AssessmentWindowRecord[] }),
      ),
    ]);
    return calendarTab(
      terms?.records ?? [],
      events?.records ?? [],
      components ?? [],
      windows?.records ?? [],
    );
  }

  if (tabSlug === "curriculum") {
    const [school, subjects, levels] = await Promise.all([
      apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`),
      apiGet<{ records: SubjectRecord[] }>(`${CONFIG}/subjects`),
      apiGet<{ records: ClassLevelRecord[] }>(`${CONFIG}/class-levels`),
    ]);
    if (!school?.record) return undefined;
    const [schemes, components] = await Promise.all([
      apiGet<GradingScheme[]>("/api/v1/academics/grading-schemes").catch(
        () => [] as GradingScheme[],
      ),
      apiGet<SectionComponent[]>("/api/v1/academics/section-assessment-components").catch(
        () => [] as SectionComponent[],
      ),
    ]);
    const built = await apiGet<{ records: CurriculumRecord[] }>(`${CONFIG}/curricula`).catch(
      () => ({ records: [] as CurriculumRecord[] }),
    );
    return curriculumTab(
      school.record,
      subjects?.records ?? [],
      levels?.records ?? [],
      schemes ?? [],
      components ?? [],
      built?.records ?? [],
    );
  }

  if (tabSlug === "policies") {
    const [saved, school] = await Promise.all([
      apiGet<{ records: PolicyItem[] }>(`${CONFIG}/school-policies`).catch(() => ({ records: [] as PolicyItem[] })),
      apiGet<{ record: SchoolRecord }>(`${CONFIG}/school-information`).catch(() => null),
    ]);
    return policiesTab(saved?.records ?? [], school?.record?.country ?? null);
  }

  if (tabSlug === "allocations") {
    const [structures, builder, sessions] = await Promise.all([
      apiGet<FeeStructure[]>("/api/v1/finance/fee-structures"),
      allocationBuilderData(),
      apiGet<{ records: SessionRecord[] }>(`${CONFIG}/sessions-terms`).catch(() => ({
        records: [] as SessionRecord[],
      })),
    ]);
    const currentTerm =
      (sessions?.records ?? []).flatMap((session) => session.terms).find((term) => term.isCurrent)?.name ?? null;
    return allocationsTab(
      structures ?? [],
      builder.classes.length,
      currentTerm,
      builder.classes.map((item) => item.name),
    );
  }

  return undefined;
}
