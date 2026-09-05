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

export interface WeightPatternRow {
  pattern: string;
  componentNames: string;
  schoolCount: number;
}

export interface CurriculumExtrasOverview {
  countrySettings: CountrySettingsRow[];
  assessmentFrameworkStats: AssessmentFrameworkStats;
  weightPatterns: WeightPatternRow[];
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

    const [schools, curricula, componentsCount, sectionComponentsCount, schoolsWithComponents, schoolsWithSectionComponents, activeComponents] = await Promise.all([
      prisma.school.findMany({ where: { deletedAt: null }, select: { country: true, timezone: true, currency: true } }),
      prisma.curriculumTemplate.findMany({ select: { country: true, calendarType: true } }),
      prisma.assessmentComponent.count(),
      prisma.sectionAssessmentComponent.count(),
      prisma.assessmentComponent.findMany({ distinct: ["schoolId"], select: { schoolId: true } }),
      prisma.sectionAssessmentComponent.findMany({ distinct: ["schoolId"], select: { schoolId: true } }),
      prisma.assessmentComponent.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { schoolId: true, name: true, weight: true }
      })
    ]);

    const bySchool = new Map<string, Array<{ name: string; weight: number }>>();
    for (const component of activeComponents) {
      const list = bySchool.get(component.schoolId) ?? [];
      list.push({ name: component.name, weight: component.weight });
      bySchool.set(component.schoolId, list);
    }
    const patternGroups = new Map<string, { componentNames: string; schoolCount: number }>();
    for (const components of bySchool.values()) {
      const pattern = components.map((c) => c.weight).join(" / ");
      if (!pattern) continue;
      const existing = patternGroups.get(pattern);
      if (existing) {
        existing.schoolCount += 1;
      } else {
        patternGroups.set(pattern, { componentNames: components.map((c) => c.name).join(", "), schoolCount: 1 });
      }
    }
    const weightPatterns: WeightPatternRow[] = Array.from(patternGroups.entries())
      .map(([pattern, v]) => ({ pattern, componentNames: v.componentNames, schoolCount: v.schoolCount }))
      .sort((a, b) => b.schoolCount - a.schoolCount);

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
      },
      weightPatterns
    };
  }
}
