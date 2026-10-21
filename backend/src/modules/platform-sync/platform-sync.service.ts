import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";
import { TIERS, type TierKey } from "../subscription-billing/billing.shared";
import { tierForPlan, applyDueTierSwitches } from "./plan-sync";
import { switchedOffModules } from "./availability";

const DAY = 86_400_000;
/** Who a platform announcement is for: the people who run the school, not every teacher and bursar. */
const ADMIN_ROLES = new Set(["SCHOOL_OWNER", "PROPRIETOR", "ADMINISTRATOR", "PRINCIPAL", "HEAD_TEACHER", "ADMIN_OFFICER"]);

type Target = { audience?: string; plans?: string[]; schoolIds?: string[] };
const asTarget = (value: unknown): Target => (value && typeof value === "object" && !Array.isArray(value) ? (value as Target) : {});
const reaches = (target: Target, school: { id: string; plan: string }) => {
  if (target.schoolIds?.length && !target.schoolIds.includes(school.id)) return false;
  if (target.plans?.length && !target.plans.map((plan) => plan.toUpperCase()).includes(school.plan)) return false;
  return true;
};

/**
 * What the Back Office has decided that a school's own app has to know and obey: the plan it is on, the modules switched off for it,
 * whether it is read-only (trial over, or the platform in maintenance), and the announcements and maintenance windows meant for it.
 * The School Admin reads this on every page; nothing here is a copy — each answer is read from the same rows the Back Office edits.
 */
@Injectable()
export class PlatformSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("PlatformSync");
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.PLAN_SWITCH_SCHEDULER === "off") return;
    const run = () => applyDueTierSwitches().then((count) => count && this.log.log(`${count} scheduled plan switch(es) took effect`)).catch((error) => this.log.warn(`plan switches: ${error instanceof Error ? error.message : error}`));
    void run();
    this.timer = setInterval(run, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async forSchool(session: SessionPayload) {
    const schoolId = session.schoolId;
    // A switch the school scheduled may have come due since the hourly run: the school should never see yesterday's plan.
    await applyDueTierSwitches(schoolId).catch(() => 0);
    const now = new Date();
    const [school, settings, off, windows, announcements, subscription] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, plan: true, status: true, billingStatus: true, trialEndsAt: true } }),
      prisma.platformSetting.findFirst({ select: { maintenanceMode: true, platformAnnouncement: true }, orderBy: { createdAt: "asc" } }),
      switchedOffModules(schoolId),
      prisma.maintenanceWindow.findMany({ where: { OR: [{ isActive: true, endsAt: { gt: now } }, { startsAt: { gt: now, lt: new Date(now.getTime() + 3 * DAY) } }] }, orderBy: { startsAt: "asc" }, take: 5 }),
      ADMIN_ROLES.has(session.role)
        ? prisma.platformAnnouncement.findMany({
            where: {
              AND: [
                { OR: [{ publishedAt: { lte: now } }, { publishedAt: null, scheduledAt: { lte: now } }] },
                { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
              ]
            },
            include: { views: { where: { schoolId }, select: { dismissedAt: true } } },
            orderBy: { createdAt: "desc" },
            take: 30
          })
        : Promise.resolve([]),
      prisma.schoolSubscription.findUnique({ where: { schoolId }, select: { tier: true, pendingTier: true, pendingFrom: true } })
    ]);
    if (!school) throw new NotFoundException("School not found.");

    const trialOver = school.status === "GRACE_PERIOD" && school.billingStatus === "TRIAL";
    const maintenance = Boolean(settings?.maintenanceMode);
    const reason = maintenance
      ? "FutureRealm is in maintenance, so every school can read but not change records until it ends."
      : trialOver
        ? "Your free trial has ended, so the school is read-only. Choose a plan in Subscription & Billing to switch editing back on."
        : null;

    // Showing an announcement is what makes "Seen" in the Back Office true.
    const visible = announcements.filter((row) => reaches(asTarget(row.target), school) && !row.views[0]?.dismissedAt);
    const unseen = visible.filter((row) => !row.views.length).map((row) => row.id);
    if (unseen.length) await prisma.platformAnnouncementView.createMany({ data: unseen.map((announcementId) => ({ announcementId, schoolId, viewedAt: now })), skipDuplicates: true }).catch(() => undefined);

    const tier = (subscription?.tier ?? tierForPlan(school.plan)) as TierKey;
    return {
      school: { name: school.name, plan: school.plan, tier: TIERS[tier]?.name ?? tier, status: school.status, billingStatus: school.billingStatus, trialEndsAt: school.trialEndsAt?.toISOString() ?? null },
      pendingSwitch: subscription?.pendingTier ? { to: TIERS[subscription.pendingTier as TierKey]?.name ?? subscription.pendingTier, from: subscription.pendingFrom?.toISOString() ?? null } : null,
      readOnly: reason ? { reason, kind: maintenance ? "maintenance" : "trial" } : null,
      platformMessage: settings?.platformAnnouncement?.trim() || null,
      windows: windows.map((window) => ({ id: window.id, title: window.title, message: window.message, startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString(), active: window.isActive && window.startsAt <= now && window.endsAt > now })),
      announcements: visible.map((row) => ({ id: row.id, title: row.title, body: row.body, type: row.type, publishedAt: (row.publishedAt ?? row.scheduledAt)?.toISOString() ?? null })),
      switchedOff: off.map(({ slug, name, scope, reason: why }) => ({ slug, name, scope, reason: why }))
    };
  }

  async dismiss(session: SessionPayload, announcementId: string) {
    const exists = await prisma.platformAnnouncement.findUnique({ where: { id: announcementId }, select: { id: true } });
    if (!exists) throw new NotFoundException("That announcement does not exist.");
    const now = new Date();
    await prisma.platformAnnouncementView.upsert({
      where: { announcementId_schoolId: { announcementId, schoolId: session.schoolId } },
      update: { dismissedAt: now },
      create: { announcementId, schoolId: session.schoolId, viewedAt: now, dismissedAt: now }
    });
    return { id: announcementId };
  }
}
