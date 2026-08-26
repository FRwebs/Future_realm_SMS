import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import type { SessionPayload } from "../../../../src/lib/auth/session-core";
import { prisma } from "../../../../src/lib/db/prisma";

const platformRoles = new Set<UserRole>([
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "SUPPORT_AGENT",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "DEVELOPER",
  "SUPER_ADMIN"
]);

function assertPlatformRole(session: SessionPayload) {
  if (!platformRoles.has(session.role as UserRole)) {
    throw new ForbiddenException("Platform admin access required.");
  }
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export interface CountrySettingsRow {
  country: string;
  schoolCount: number;
  defaultTimezone: string | null;
  defaultCurrency: string | null;
  curriculumTemplateCount: number;
  calendarTypes: Array<{ calendarType: string; count: number }>;
}

export interface AssessmentFrameworkStats {
  totalComponents: number;
  totalSectionComponents: number;
  schoolsWithFrameworks: number;
}

export interface CurriculumExtrasOverview {
  countrySettings: CountrySettingsRow[];
  assessmentFrameworkStats: AssessmentFrameworkStats;
}

@Injectable()
export class CurriculumExtrasService {
  /**
   * Real-data country reference view. There is no dedicated "platform country config" model
   * in the schema — this aggregates what genuinely IS country-scoped today: School.country /
   * timezone / currency (per-school, defaulted to Nigeria / Africa/Lagos / NGN) and
   * CurriculumTemplate.country / calendarType (the master curriculum library). If every school
   * and template is Nigeria, that is reported honestly as the single supported country rather
   * than implying a multi-country settings system that doesn't exist yet.
   */
  async getOverview(session: SessionPayload): Promise<CurriculumExtrasOverview> {
    assertPlatformRole(session);

    const [schools, curricula, componentsCount, sectionComponentsCount, schoolsWithComponents, schoolsWithSectionComponents] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null }, select: { country: true, timezone: true, currency: true } }),
      prisma.curriculumTemplate.findMany({ select: { country: true, calendarType: true } }),
      prisma.assessmentComponent.count(),
      prisma.sectionAssessmentComponent.count(),
      prisma.assessmentComponent.findMany({ distinct: ["schoolId"], select: { schoolId: true } }),
      prisma.sectionAssessmentComponent.findMany({ distinct: ["schoolId"], select: { schoolId: true } })
    ]);

    const countries = new Set<string>([...schools.map((s) => s.country), ...curricula.map((c) => c.country)]);

    const countrySettings: CountrySettingsRow[] = Array.from(countries)
      .sort((a, b) => a.localeCompare(b))
      .map((country) => {
        const schoolsInCountry = schools.filter((s) => s.country === country);
        const curriculaInCountry = curricula.filter((c) => c.country === country);
        const calendarCounts = new Map<string, number>();
        for (const template of curriculaInCountry) {
          calendarCounts.set(template.calendarType, (calendarCounts.get(template.calendarType) ?? 0) + 1);
        }
        return {
          country,
          schoolCount: schoolsInCountry.length,
          defaultTimezone: mostCommon(schoolsInCountry.map((s) => s.timezone)),
          defaultCurrency: mostCommon(schoolsInCountry.map((s) => s.currency)),
          curriculumTemplateCount: curriculaInCountry.length,
          calendarTypes: Array.from(calendarCounts.entries())
            .map(([calendarType, count]) => ({ calendarType, count }))
            .sort((a, b) => b.count - a.count)
        };
      });

    const schoolIdsWithFrameworks = new Set<string>([
      ...schoolsWithComponents.map((s) => s.schoolId),
      ...schoolsWithSectionComponents.map((s) => s.schoolId)
    ]);

    return {
      countrySettings,
      assessmentFrameworkStats: {
        totalComponents: componentsCount,
        totalSectionComponents: sectionComponentsCount,
        schoolsWithFrameworks: schoolIdsWithFrameworks.size
      }
    };
  }
}
