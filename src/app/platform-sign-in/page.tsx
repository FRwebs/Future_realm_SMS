import type { Metadata } from "next";

import { PlatformSignInForm } from "@/components/super-admin/platform-sign-in-form";

export const metadata: Metadata = {
  title: "Internal sign-in · FutureRealm Platform Admin",
  description: "FutureRealm team accounts only. Schools sign in at their own workspace.",
  robots: { index: false, follow: false },
};

type AccessControl = {
  idleMinutes: number;
  trustDays: number;
  ipAllowListEnforced: boolean;
  levels: Array<{ level: string; role: string; scope: string }>;
};

/** The product's own default, used when the API cannot be reached. */
const FALLBACK: AccessControl = {
  idleMinutes: 30,
  trustDays: 30,
  ipAllowListEnforced: false,
  levels: [
    { level: "1", role: "Super Admin", scope: "Every module, every function · Global data scope" },
    { level: "2", role: "Department Lead", scope: "Full within own department, at or below a set ceiling" },
    { level: "3", role: "Team Member", scope: "Function-scoped, normally Assigned or Portfolio scope" },
    { level: "4", role: "Read-Only / Advisor", scope: "View-only, scope None — aggregates without identities" },
  ],
};

/**
 * The back office's own front door.
 *
 * Separate from the school sign-in on purpose: the mockup puts this on its own
 * restricted address, says in the panel that it is never linked from a
 * school-facing page, and the copy here repeats that rather than softening it.
 * A school account that finds this URL is refused by the API, not by hiding the
 * form.
 */
async function loadAccessControl(): Promise<AccessControl> {
  try {
    const { apiGet } = await import("@/lib/api/server");
    return (await apiGet<AccessControl>("/api/v1/platform-auth/access-control")) ?? FALLBACK;
  } catch {
    // The sign-in page must render even when the API is down — otherwise the
    // one page you need in an incident is the one that will not load.
    return FALLBACK;
  }
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3EE08A"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", marginTop: 2 }}
      aria-hidden
    >
      <path d="M12 3.2 19 6v6c0 4-3 7.4-7 8.3-4-.9-7-4.3-7-8.3V6z" />
      <path d="m9.3 12 2 2 3.4-3.7" />
    </svg>
  );
}

export default async function PlatformSignInPage() {
  const access = await loadAccessControl();

  const stats = [
    { value: "Platform", label: "Fourteen modules" },
    { value: `${access.idleMinutes}m`, label: "Idle sign-out" },
    { value: access.ipAllowListEnforced ? "On" : "Off", label: "IP allow list" },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Left: what this panel is, and the warning that it is not a school page. */}
      <section
        className="relative flex min-w-0 flex-col justify-between overflow-hidden px-8 py-10 md:px-[50.5px] md:py-[47px]"
        style={{ background: "#0D2315", flex: "1.05" }}
      >
        <div>
          <div className="mb-10 flex items-center gap-[11px] md:mb-[57.5px]">
            <span
              className="font-(family-name:--font-heading) text-[17px] font-extrabold tracking-[-0.02em] text-white"
            >
              FutureRealm
            </span>
            <span
              className="flex items-center gap-[5.5px] rounded-full px-[9px] py-[3.5px]"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
            >
              <span className="h-[5.5px] w-[5.5px] rounded-full" style={{ background: "#3EE08A" }} />
              <span className="text-[9px] font-bold tracking-[0.07em] text-white">PLATFORM ADMIN</span>
            </span>
          </div>

          <h1
            className="max-w-[432px] font-(family-name:--font-heading) text-[28px] font-bold leading-[1.18] tracking-[-0.015em] text-white md:text-[34px]"
          >
            The control center behind every school on the platform.
          </h1>
          <p
            className="mt-4 max-w-[387px] text-[13px] leading-[1.65]"
            style={{ color: "rgba(255,255,255,0.62)" }}
          >
            Fourteen modules — accounts, billing, partners, migration, support, analytics, security and
            infrastructure — in one internal operating picture.
          </p>

          <div className="mt-[32.5px] grid max-w-[414px] grid-cols-3 gap-[11px]">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[13px] px-[14.5px] py-[13.5px]"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}
              >
                <div className="font-(family-name:--font-heading) text-[20px] font-bold leading-none text-white">
                  {stat.value}
                </div>
                <div className="mt-[5.5px] text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative z-10 mt-10 flex max-w-[414px] gap-[11.5px] rounded-[16px] px-5 py-[18px]"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <ShieldIcon />
          <div>
            <p className="mb-[4.5px] text-[11.5px] font-semibold text-white">
              Internal use only — not visible to any school
            </p>
            <p className="text-[11px] leading-[1.6]" style={{ color: "rgba(255,255,255,0.6)" }}>
              This panel is served from a separate, non-public URL and is never linked from any
              school-facing page. Every action you take is written to the immutable audit log.
            </p>
          </div>
        </div>
      </section>

      {/* Right: the form itself. */}
      <section
        className="flex min-w-0 items-center justify-center bg-white p-8 md:p-9"
        style={{ flex: "0.95" }}
      >
        <PlatformSignInForm access={access} />
      </section>
    </main>
  );
}
