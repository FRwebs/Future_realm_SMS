import { differenceInCalendarDays, isToday } from "date-fns";

import type {
  AdmissionApplicationView,
  AdmissionMetricsView,
} from "@/lib/domain/types";
import { formatNigeriaClassName } from "@/lib/school-options";

export type AdmissionPortalColumn = {
  id: string;
  label: string;
  statuses: AdmissionApplicationView["status"][];
  tone: "neutral" | "warning" | "success" | "danger";
};

export const admissionPortalColumns: AdmissionPortalColumn[] = [
  {
    id: "submitted",
    label: "Submitted",
    statuses: ["DRAFT", "SUBMITTED", "INCOMPLETE", "AWAITING_DOCUMENTS"],
    tone: "neutral",
  },
  {
    id: "review",
    label: "Under Review",
    statuses: ["REVIEWING", "PAYMENT_PENDING"],
    tone: "warning",
  },
  {
    id: "screening",
    label: "Screening",
    statuses: ["SCREENING_SCHEDULED", "SCREENING_COMPLETED", "RECOMMENDED"],
    tone: "warning",
  },
  {
    id: "offer",
    label: "Offer Window",
    statuses: ["APPROVED", "CONDITIONALLY_APPROVED", "OFFER_SENT"],
    tone: "success",
  },
  {
    id: "enrollment",
    label: "Enrollment",
    statuses: ["ACCEPTED", "FINANCIALLY_CLEARED", "ENROLLED", "ACTIVE"],
    tone: "success",
  },
  {
    id: "closed",
    label: "Closed",
    statuses: ["WAITLISTED", "REJECTED", "DECLINED"],
    tone: "danger",
  },
];

export function formatAdmissionStage(status: AdmissionApplicationView["status"]) {
  return status.replaceAll("_", " ");
}

export function getAdmissionPipeline(applications: AdmissionApplicationView[]) {
  return admissionPortalColumns.map((column) => ({
    ...column,
    applications: applications.filter((application) =>
      column.statuses.includes(application.status),
    ),
  }));
}

export function getAdmissionAgeInDays(application: AdmissionApplicationView) {
  return differenceInCalendarDays(new Date(), new Date(application.submittedAt));
}

export function hasAdmissionDocumentAttention(
  application: AdmissionApplicationView,
) {
  if (
    application.status === "AWAITING_DOCUMENTS" ||
    application.status === "INCOMPLETE"
  ) {
    return true;
  }

  if ((application.missingRequirements?.length ?? 0) > 0) {
    return true;
  }

  return (application.documents ?? []).some((document) => !document.isVerified);
}

export function getAdmissionScreeningStatus(
  application: AdmissionApplicationView,
) {
  if (!application.latestScreening) return "Not scheduled";
  if (application.latestScreening.completedAt)
    return application.latestScreening.result ?? "Completed";
  if (isToday(new Date(application.latestScreening.scheduledAt))) return "Today";
  return "Scheduled";
}

export function getAdmissionScreeningDesk(
  applications: AdmissionApplicationView[],
) {
  return applications
    .filter(
      (application) =>
        application.latestScreening ||
        application.status === "SCREENING_SCHEDULED" ||
        application.status === "SCREENING_COMPLETED" ||
        application.status === "RECOMMENDED",
    )
    .sort((left, right) => {
      const leftDate = left.latestScreening?.scheduledAt ?? left.submittedAt;
      const rightDate = right.latestScreening?.scheduledAt ?? right.submittedAt;
      return new Date(leftDate).getTime() - new Date(rightDate).getTime();
    });
}

export function getAdmissionOffers(
  applications: AdmissionApplicationView[],
) {
  return applications
    .filter(
      (application) =>
        application.offerStatus ||
        ["APPROVED", "CONDITIONALLY_APPROVED", "OFFER_SENT", "ACCEPTED", "DECLINED"].includes(
          application.status,
        ),
    )
    .sort((left, right) => {
      const leftDate = left.offerExpiresAt ?? left.submittedAt;
      const rightDate = right.offerExpiresAt ?? right.submittedAt;
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
}

export function getReadyToEnrollAdmissions(
  applications: AdmissionApplicationView[],
) {
  return applications
    .filter((application) =>
      ["ACCEPTED", "FINANCIALLY_CLEARED"].includes(application.status),
    )
    .sort(
      (left, right) =>
        new Date(right.acceptedAt ?? right.submittedAt).getTime() -
        new Date(left.acceptedAt ?? left.submittedAt).getTime(),
    );
}

export function buildAdmissionDashboardData(
  applications: AdmissionApplicationView[],
  metrics: AdmissionMetricsView,
) {
  const todayScreenings = applications.filter(
    (application) =>
      application.latestScreening &&
      isToday(new Date(application.latestScreening.scheduledAt)),
  );
  const offersExpiringSoon = applications.filter((application) => {
    if (!application.offerExpiresAt || application.offerStatus !== "SENT")
      return false;
    const days = differenceInCalendarDays(
      new Date(application.offerExpiresAt),
      new Date(),
    );
    return days >= 0 && days <= 2;
  });
  const pendingReview = applications.filter((application) =>
    ["SUBMITTED", "INCOMPLETE", "AWAITING_DOCUMENTS", "REVIEWING"].includes(
      application.status,
    ),
  );

  return {
    totalApplications: metrics.totalApplications,
    pendingReviewCount: pendingReview.length,
    offersSentCount: applications.filter(
      (application) =>
        application.offerStatus === "SENT" ||
        application.status === "OFFER_SENT",
    ).length,
    enrolledCount: applications.filter((application) =>
      ["ENROLLED", "ACTIVE"].includes(application.status),
    ).length,
    vacancyPressureClasses: metrics.byClass
      .slice()
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    funnel: admissionPortalColumns.map((column) => ({
      id: column.id,
      label: column.label,
      count: applications.filter((application) =>
        column.statuses.includes(application.status),
      ).length,
    })),
    alerts: [
      {
        id: "pending-review",
        label: "Applications pending review for 3+ days",
        count: pendingReview.filter(
          (application) => getAdmissionAgeInDays(application) >= 3,
        ).length,
        href: "/portals/admission-officer/applications?status=SUBMITTED",
      },
      {
        id: "docs-pending",
        label: "Applications with pending document attention",
        count: applications.filter(hasAdmissionDocumentAttention).length,
        href: "/portals/admission-officer/applications?status=AWAITING_DOCUMENTS",
      },
      {
        id: "screenings-today",
        label: "Screenings scheduled for today",
        count: todayScreenings.length,
        href: "/portals/admission-officer/screenings",
      },
      {
        id: "offers-expiring",
        label: "Offers expiring within 48 hours",
        count: offersExpiringSoon.length,
        href: "/portals/admission-officer/offers",
      },
      {
        id: "ready-enroll",
        label: "Applicants ready for enrollment handoff",
        count: getReadyToEnrollAdmissions(applications).length,
        href: "/portals/admission-officer/ready-to-enroll",
      },
    ],
    recentApplications: applications.slice(0, 8),
    dailyVolume: buildRecentDailyVolume(applications),
    classDemand: metrics.byClass.map((item) => ({
      ...item,
      className: formatNigeriaClassName(item.className),
    })),
  };
}

function buildRecentDailyVolume(applications: AdmissionApplicationView[]) {
  const buckets = new Map<string, number>();

  for (const application of applications) {
    const key = new Date(application.submittedAt).toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-10)
    .map(([date, count]) => ({ date, count }));
}
