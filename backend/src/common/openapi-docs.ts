import type { OpenAPIObject } from "@nestjs/swagger";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
type OpenApiOperation = Record<string, unknown> & {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
};

const HTTP_METHODS = new Set<HttpMethod>(["get", "post", "put", "patch", "delete"]);

const COOKIE_SECURITY = [{ fr_session: [] }];

const API_TAGS = [
  {
    name: "Auth",
    description:
      "Authentication endpoints for creating, checking, and ending FutureRealm SMS web sessions."
  },
  {
    name: "Dashboard",
    description:
      "School dashboard metrics and operational summaries scoped to the authenticated user's school."
  },
  {
    name: "Students",
    description:
      "Student records, enrolment context, class placement, guardian links, and student lifecycle actions."
  },
  {
    name: "Staff",
    description:
      "School staff HR records, teacher records, role assignment, account status, and staff lifecycle management."
  },
  {
    name: "Profiles",
    description:
      "Self-service and admin-managed profile data, documents, edit requests, and login history."
  },
  {
    name: "Admissions",
    description:
      "Admissions applications, screening, review, offer, clearance, and enrolment workflows."
  },
  {
    name: "Academics",
    description:
      "Academic setup, Nigerian grading, subjects, assessments, score entry, broadsheets, and result publishing."
  },
  {
    name: "Classes",
    description:
      "Nigerian class levels and arms, form teachers, class members, attendance, results, and skills."
  },
  {
    name: "Attendance",
    description:
      "Student attendance marking and summaries for class teachers, administrators, students, and parents."
  },
  {
    name: "Timetable",
    description:
      "Weekly class and teacher timetables, period definitions, teacher conflict checks, and publish workflows."
  },
  {
    name: "Finance",
    description:
      "Fees, invoices, payments, discounts, waivers, installment plans, receipts, and finance reports."
  },
  {
    name: "Reports",
    description:
      "Printable/exportable academic reports, broadsheets, report cards, CSV, Excel, and PDF outputs."
  },
  {
    name: "Configuration",
    description:
      "School-level configuration for sessions, terms, class levels, arms, calendar, finance, academics, and settings."
  },
  {
    name: "Roles / Permissions",
    description:
      "Role templates, custom roles, permission checks, role assignment, and permission matrix management."
  },
  {
    name: "Operations",
    description:
      "School operations including discipline, counselling, health, visitors, inventory, facilities, transport, and leave."
  },
  {
    name: "Nigerian Operations",
    description:
      "Nigeria-specific school operations such as curriculum tracking, staff attendance, and training records."
  },
  {
    name: "Communications",
    description:
      "Announcements and communication features for staff, parents, students, and school administrators."
  },
  {
    name: "Teachers",
    description:
      "Teacher directory, teacher activities, and teacher profile summaries."
  },
  {
    name: "Teacher Portal",
    description:
      "Teacher-only dashboard, assignments, timetable, attendance, score entry, tasks, and notifications."
  },
  {
    name: "Student Portal",
    description:
      "Student-only dashboard, profile, attendance, results, timetable, fees, services, and notifications."
  },
  {
    name: "Parent Portal",
    description:
      "Parent-only dashboard, linked children, child attendance/results/fees/timetable, announcements, and profile."
  },
  {
    name: "Super Admin",
    description:
      "Platform administration endpoints for cross-school oversight, subscriptions, billing, audit, and schools."
  }
] as const;

const TAG_ALIASES: Record<string, string> = {
  academics: "Academics",
  admissions: "Admissions",
  attendance: "Attendance",
  auth: "Auth",
  classes: "Classes",
  communications: "Communications",
  configuration: "Configuration",
  dashboard: "Dashboard",
  finance: "Finance",
  "nigeria-operations": "Nigerian Operations",
  operations: "Operations",
  "parent-portal": "Parent Portal",
  profiles: "Profiles",
  profile: "Profiles",
  reports: "Reports",
  "roles-management": "Roles / Permissions",
  staff: "Staff",
  "student-portal": "Student Portal",
  students: "Students",
  "super-admin": "Super Admin",
  "teacher-portal": "Teacher Portal",
  teachers: "Teachers",
  timetable: "Timetable"
};

const UUID_EXAMPLES: Record<string, string> = {
  academicYearId: "b3b1b9ce-3bc8-457f-86f2-df7f9fd78572",
  applicationId: "7e681de0-e8d5-445f-a82d-7c5f61e9f68f",
  assessmentId: "9b9b9ac1-3b12-4c79-a1a3-d7edb8e9a122",
  broadsheetId: "bda8504f-3ea0-4232-88ec-fd4b6d1d51f",
  childId: "38b87f67-760f-49b3-8de5-0f7e7a77c1d2",
  classId: "1f4ca8ea-094f-45a5-b2d1-a7d0a7a92f95",
  componentId: "cb28eaa4-eeb5-44df-a724-0e9cc8367790",
  configId: "dfb6e984-fef1-4a72-9ea9-f5530c6ab141",
  documentId: "3f16c0f4-5e05-4cbd-a50d-35d82578aa38",
  eventId: "5a66b4e6-26f4-41d2-bb22-f678eac61907",
  feeStructureId: "0c36a1e0-b263-43ee-9d5f-fd4977b7e8af",
  id: "7a0e4b88-3d10-47d3-8ec6-0e6e9aa7d2b3",
  invoiceId: "1b9e23de-5514-46d8-b0cd-8de90f6333b7",
  participantId: "31b74707-7358-4784-865e-05cd1d7ad37b",
  requestId: "edbb6240-cea2-4589-9d53-134f0fdfdd11",
  roleId: "5fed88cc-feb3-4d04-b6fd-8d4f5df35d42",
  schoolId: "9047867d-1ceb-4c27-b980-cd39e6dc7d60",
  slotId: "e1882754-e044-4548-b78f-9cf052fbdc5b",
  staffId: "34f6edb4-02b6-4fbf-9066-17382dd402ad",
  studentId: "15ec70c7-2e66-45c7-a376-df55f4aee769",
  subjectId: "8fb2c1c2-d9e5-4d5a-9e28-636a21985615",
  teacherId: "279e4e13-03ca-4325-8c1f-0207e6747b94",
  termId: "f7123f38-5697-4370-a9e3-9d7038b0f25d",
  topicId: "2fb9aac4-678a-45d2-98ed-b84ec0a569dd",
  trainingProgramId: "37981c0e-7c5b-4626-b22f-ff4066f206a2",
  userId: "0ca836a9-d4a7-4f48-9ac2-c8d917720655"
};

const COMMON_RESPONSE_SCHEMAS = {
  ApiSuccessEnvelope: {
    type: "object",
    properties: {
      ok: { type: "boolean", example: true },
      success: {
        type: "boolean",
        nullable: true,
        example: true,
        description:
          "Some newer endpoints include this alongside ok for frontend compatibility."
      },
      message: {
        type: "string",
        nullable: true,
        example: "Request completed successfully."
      },
      data: {
        nullable: true,
        description:
          "Resource payload. Shape depends on the endpoint and is documented with endpoint examples."
      },
      meta: {
        nullable: true,
        description:
          "Optional metadata such as pagination, totals, current academic year, or current term."
      }
    },
    required: ["ok"]
  },
  ApiErrorEnvelope: {
    type: "object",
    properties: {
      ok: { type: "boolean", example: false },
      error: {
        type: "string",
        example: "Validation failed: email must be a valid email address"
      }
    },
    required: ["ok", "error"]
  },
  PaginationMeta: {
    type: "object",
    properties: {
      page: { type: "integer", example: 1 },
      limit: { type: "integer", example: 20 },
      total: { type: "integer", example: 127 },
      totalPages: { type: "integer", example: 7 }
    }
  },
  SessionUser: {
    type: "object",
    properties: {
      userId: { type: "string", format: "uuid", example: UUID_EXAMPLES.userId },
      schoolId: { type: "string", format: "uuid", example: UUID_EXAMPLES.schoolId },
      email: { type: "string", format: "email", example: "principal@futureacademy.ng" },
      role: { type: "string", example: "PRINCIPAL" },
      portalType: { type: "string", example: "school" }
    }
  }
};

export function enrichOpenApiDocument(document: OpenAPIObject) {
  document.info.description = [
    "Production API documentation for the FutureRealm multi-tenant School Management System.",
    "",
    "Authentication uses the `fr_session` HTTP-only cookie issued by `/api/v1/auth/login`. State-changing browser requests also use the app CSRF cookie/header flow enforced by the backend guards.",
    "",
    "School-level endpoints are tenant scoped by the authenticated session's `schoolId`. Clients must not pass another school ID unless the endpoint is explicitly under Super Admin/platform administration and the authenticated user has platform access.",
    "",
    "Most JSON responses use `{ ok: true, data }` or `{ ok: true, success: true, message, data }`. Errors from the global exception filter use `{ ok: false, error }`."
  ].join("\n");

  document.tags = API_TAGS.map((tag) => ({ ...tag }));
  document.components ??= {};
  document.components.securitySchemes ??= {};
  document.components.securitySchemes.fr_session = {
    type: "apiKey",
    in: "cookie",
    name: "fr_session",
    description:
      "HTTP-only session cookie set by the login endpoint. Include browser credentials for school, parent, student, and platform portal requests."
  };
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...COMMON_RESPONSE_SCHEMAS
  };

  Object.entries(document.paths).forEach(([path, pathItem]) => {
    if (!pathItem) return;

    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!HTTP_METHODS.has(method as HttpMethod)) return;
      enrichOperation(path, method as HttpMethod, operation as OpenApiOperation);
    });
  });
}

function enrichOperation(path: string, method: HttpMethod, operation: OpenApiOperation) {
  const tag = getDisplayTag(operation, path);
  operation.tags = [tag];
  const summary = operation.summary ?? buildSummary(method, path, tag);
  operation.summary = summary;
  operation.description = buildDescription({
    path,
    method,
    tag,
    summary,
    existingDescription: typeof operation.description === "string" ? operation.description : undefined
  });

  if (!isPublicEndpoint(path, method)) {
    operation.security ??= COOKIE_SECURITY;
  }

  operation.parameters = mergeParameters(
    Array.isArray(operation.parameters) ? operation.parameters : [],
    [
      ...buildPathParameters(path),
      ...buildQueryParameters(path, method)
    ]
  );

  if (["post", "put", "patch"].includes(method) && shouldDocumentRequestBody(path, method) && !operation.requestBody) {
    operation.requestBody = buildRequestBody(path, method);
  }

  operation.responses = mergeResponses(
    typeof operation.responses === "object" && operation.responses ? operation.responses : {},
    buildResponses(path, method)
  );

  operation.operationId ||= buildOperationId(method, path);

  operation["x-tenant-scope"] = getTenantScope(path);
  operation["x-authentication"] = isPublicEndpoint(path, method)
    ? "Public endpoint. No fr_session cookie is required."
    : "Authenticated endpoint. Include the fr_session cookie and satisfy the controller's role/permission guard.";
  operation["x-authorization-note"] = getAuthorizationNote(path, method);
}

function getDisplayTag(operation: OpenApiOperation, path: string) {
  const firstTag = operation.tags?.[0];
  if (firstTag && TAG_ALIASES[firstTag]) return TAG_ALIASES[firstTag];
  if (firstTag && API_TAGS.some((tag) => tag.name === firstTag)) return firstTag;

  const moduleSegment = path.split("/").filter(Boolean).find((segment) => segment !== "api" && segment !== "v1");
  return moduleSegment ? TAG_ALIASES[moduleSegment] ?? toTitleCase(moduleSegment) : "API";
}

function buildSummary(method: HttpMethod, path: string, tag: string) {
  const explicitSummary = getExplicitSummary(method, path);
  if (explicitSummary) return explicitSummary;

  const cleanSegments = getResourceSegments(path);
  const rawSegments = getRawResourceSegments(path);
  const actionSegment = cleanSegments.at(-1) ?? tag;
  const subject = toTitleCase(cleanSegments.filter((segment) => !isParameterSegment(segment)).join(" "));

  if (method === "get") {
    if (isExportPath(path)) return `Export ${subject}`;
    if (hasPathParameter(path)) {
      const targetSegment = rawSegments.at(-1)?.includes("{") ? cleanSegments.at(-2) ?? actionSegment : actionSegment;
      return `Get ${toTitleCase(targetSegment)} details`;
    }
    return `List ${subject || tag}`;
  }

  if (method === "post") {
    if (isActionSegment(actionSegment)) return `${toTitleCase(actionSegment)} ${toTitleCase(cleanSegments.at(-2) ?? tag)}`;
    return `Create ${subject || tag}`;
  }

  if (method === "put") return `Replace or update ${subject || tag}`;
  if (method === "patch") return `Update ${toTitleCase(actionSegment)}`;
  if (method === "delete") return `Delete or archive ${toTitleCase(cleanSegments.at(-2) ?? actionSegment)}`;
  return `${(method as string).toUpperCase()} ${subject || tag}`;
}

function getExplicitSummary(method: HttpMethod, path: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/auth/login")) return "Log in and create a session";
  if (lowerPath.includes("/auth/logout")) return "Log out and clear session cookies";
  if (lowerPath.includes("/auth/session")) return "Get current authenticated session";
  if (lowerPath.includes("/dashboard/overview")) return "Get school dashboard overview";
  if (lowerPath.includes("/reports/broadsheet/") && lowerPath.endsWith("/pdf")) return "Export broadsheet as PDF";
  if (lowerPath.includes("/reports/broadsheet/") && lowerPath.endsWith("/csv")) return "Export broadsheet as CSV";
  if (lowerPath.includes("/reports/broadsheet/") && lowerPath.endsWith("/excel")) return "Export broadsheet as Excel";
  if (lowerPath.includes("/reports/report-card/")) return "Get student report card";
  if (lowerPath.includes("/timetable/{classid}") && method === "get") return "Get full class timetable grid";
  if (lowerPath.includes("/timetable/{classid}/slot") && method === "post") return "Create or update a timetable slot";
  if (lowerPath.includes("/timetable/{classid}/slot/") && method === "delete") return "Clear or delete a timetable slot";
  if (lowerPath.includes("/timetable/{classid}/publish")) return "Publish or unpublish a class timetable";
  if (lowerPath.includes("/timetable/classes")) return "List classes with timetable setup status";
  if (lowerPath.includes("/timetable/conflicts/check")) return "Check timetable teacher conflicts";
  if (lowerPath.includes("/timetable/teacher/my")) return "Get my teacher timetable";
  if (lowerPath.includes("/academics/subjects/{subjectid}/assign-teacher")) return "Assign teacher to subject for class arms";
  if (lowerPath.includes("/classes/{classid}/assign-teacher")) return "Assign form teachers to a class";
  if (lowerPath.includes("/staff/{staffid}/roles")) return "Assign roles to staff member";
  if (lowerPath.includes("/staff/{staffid}/status")) return "Update staff account or employment status";
  if (lowerPath.includes("/profiles/edit-requests/") && lowerPath.endsWith("/review")) return "Review profile edit request";
  if (lowerPath.includes("/profile/me/edit-requests") && method === "post") return "Submit my profile edit request";
  return undefined;
}

function buildDescription(input: {
  path: string;
  method: HttpMethod;
  tag: string;
  summary: string;
  existingDescription?: string;
}) {
  const notes = [
    input.existingDescription,
    describeEndpointPurpose(input.path, input.method, input.tag),
    "",
    `Authentication: ${isPublicEndpoint(input.path, input.method) ? "Public endpoint." : "Requires a valid FutureRealm SMS session cookie (`fr_session`)."}`,
    `Authorization: ${getAuthorizationNote(input.path, input.method)}`,
    `Tenant scope: ${getTenantScope(input.path)}`,
    describeQueryUsage(input.path, input.method),
    describeMutationUsage(input.path, input.method)
  ].filter(Boolean);

  return notes.join("\n");
}

function describeEndpointPurpose(path: string, method: HttpMethod, tag: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/auth/login")) {
    return "Authenticates a user and sets the SMS session and CSRF cookies used by the web app.";
  }
  if (lowerPath.includes("/auth/session")) {
    return "Returns the currently authenticated session payload for bootstrapping the frontend auth state.";
  }
  if (lowerPath.includes("/auth/logout")) {
    return "Clears the session and CSRF cookies for the current browser.";
  }
  if (lowerPath.includes("/timetable")) {
    return "Manages or reads class and teacher timetables. Nigerian class arms have separate weekly timetables and teacher conflicts are enforced server-side where relevant.";
  }
  if (lowerPath.includes("/classes")) {
    return "Reads or manages Nigerian class levels and arms such as Nursery, Primary, JSS, and SS streams. School users only see classes in their own school unless role scope narrows the result further.";
  }
  if (lowerPath.includes("/academics/subjects")) {
    return "Manages subjects, WAEC/NECO metadata, class applicability, and per-class teacher assignments.";
  }
  if (lowerPath.includes("/admissions")) {
    return "Runs the admissions pipeline from application capture through review, screening, offer, financial clearance, registration, and enrolment.";
  }
  if (lowerPath.includes("/finance")) {
    return "Handles school finance workflows such as fee setup, invoice generation, payment recording, payment verification, discounts, waivers, and installment plans.";
  }
  if (lowerPath.includes("/profile")) {
    return "Reads or updates profile, HR, document, security, and edit-request data for the current user or permission-approved staff administrators.";
  }
  if (lowerPath.includes("/staff")) {
    return "Manages academic and non-academic staff records, teacher profiles, role assignment, status changes, and safe archive behavior.";
  }
  if (lowerPath.includes("/super-admin")) {
    return "Platform-level administration endpoint for cross-school oversight. These routes are not for normal school portal users.";
  }
  if (lowerPath.includes("/reports")) {
    return "Produces academic reports and exports. File endpoints return binary or text content instead of the normal JSON envelope.";
  }
  if (method === "get") {
    return `Retrieves ${tag.toLowerCase()} data for the authenticated user context.`;
  }
  return `Performs a ${method.toUpperCase()} mutation in the ${tag} module using the existing service validation and audit rules.`;
}

function describeQueryUsage(path: string, method: HttpMethod) {
  if (method !== "get") return "";
  const queries = buildQueryParameters(path, method);
  if (queries.length === 0) return "";
  const names = queries.map((query) => `\`${String(query.name)}\``).join(", ");
  return `Query usage: supported query parameters include ${names}. Combine filters to narrow results; list endpoints default to the backend service defaults when pagination or sorting is omitted.`;
}

function describeMutationUsage(path: string, method: HttpMethod) {
  if (!["post", "put", "patch", "delete"].includes(method)) return "";
  if (method === "delete") {
    return "Mutation notes: delete endpoints may soft-delete, archive, clear, or block deletion when dependent records exist, following the module's domain rules.";
  }
  if (!shouldDocumentRequestBody(path, method)) {
    return "Mutation notes: no JSON request body is required. The workflow uses the authenticated session and route parameters.";
  }
  if (path.toLowerCase().includes("/roles") || path.toLowerCase().includes("assign")) {
    return "Mutation notes: assignment-style endpoints are permission-protected, validated against school scope, and audited where the module records sensitive changes.";
  }
  return "Mutation notes: the request body is validated by the module service/schema. School-scoped mutations never update records belonging to another school.";
}

function buildPathParameters(path: string) {
  const matches = [...path.matchAll(/\{([^}]+)\}/g)];
  return matches.map((match) => {
    const name = match[1];
    return {
      name,
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      example: UUID_EXAMPLES[name] ?? UUID_EXAMPLES.id,
      description: describePathParameter(name)
    };
  });
}

function buildQueryParameters(path: string, method: HttpMethod) {
  if (method !== "get") {
    if (path.includes("/slot/")) {
      return [
        queryParam("clear_only", "boolean", "When true, keeps the timetable row and turns it into a free period instead of deleting the row.", "true")
      ];
    }
    return [];
  }

  const lowerPath = path.toLowerCase();
  const params: Array<Record<string, unknown>> = [];
  const listEndpoint = isLikelyListEndpoint(path);

  if (listEndpoint) {
    params.push(
      queryParam("page", "integer", "Page number for paginated list endpoints. Defaults to the service default, commonly 1.", 1),
      queryParam("limit", "integer", "Maximum records to return per page. Defaults to the service default, commonly 20.", 20),
      queryParam("search", "string", "Fuzzy search term. Matching fields depend on the module, such as name, code, email, admission number, or staff ID.", "David"),
      queryParam("sortBy", "string", "Field to sort by when the endpoint supports sorting.", "createdAt"),
      queryParam("sortOrder", "string", "Sort direction.", "desc", ["asc", "desc"])
    );
  }

  if ((lowerPath.includes("/students") || lowerPath.includes("/student-portal")) && listEndpoint) {
    params.push(
      queryParam("status", "string", "Student status filter.", "ACTIVE", ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED", "SUSPENDED"]),
      queryParam("classLevelId", "string", "Filter by class level ID.", UUID_EXAMPLES.classId),
      queryParam("classArmId", "string", "Filter by class arm ID.", UUID_EXAMPLES.classId),
      queryParam("sessionId", "string", "Academic session ID for academic-period scoped student data.", UUID_EXAMPLES.academicYearId),
      queryParam("termId", "string", "Academic term ID for term-scoped student data.", UUID_EXAMPLES.termId),
      queryParam("includeInactive", "boolean", "Include inactive or archived students when the endpoint supports it.", "false")
    );
  }

  if ((lowerPath.includes("/staff") || lowerPath.includes("/teachers")) && listEndpoint) {
    params.push(
      queryParam("staffType", "string", "Filter staff by academic or non-academic classification.", "ACADEMIC", ["ACADEMIC", "NON_ACADEMIC"]),
      queryParam("status", "string", "Filter staff by account/employment status.", "ACTIVE", ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]),
      queryParam("departmentId", "string", "Filter staff by department.", UUID_EXAMPLES.id),
      queryParam("role", "string", "Filter by primary SMS role.", "TEACHER"),
      queryParam("designation", "string", "Filter by designation or job title.", "Mathematics Teacher")
    );
  }

  if (lowerPath.includes("/admissions") && listEndpoint) {
    params.push(
      queryParam("status", "string", "Application status filter.", "SUBMITTED", ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "OFFERED", "ADMITTED", "REJECTED"]),
      queryParam("stage", "string", "Admissions workflow stage filter.", "screening"),
      queryParam("classLevelId", "string", "Filter applications by intended class level.", UUID_EXAMPLES.classId),
      queryParam("dateFrom", "string", "Start date for application or workflow filters in YYYY-MM-DD format.", "2026-01-01"),
      queryParam("dateTo", "string", "End date for application or workflow filters in YYYY-MM-DD format.", "2026-01-31")
    );
  }

  if ((lowerPath.includes("/academics") || lowerPath.includes("/results") || lowerPath.includes("/reports")) && listEndpoint) {
    params.push(
      queryParam("sessionId", "string", "Academic session ID. Use with termId for period-scoped academic records.", UUID_EXAMPLES.academicYearId),
      queryParam("termId", "string", "Academic term ID. Use with sessionId for scores, results, broadsheets, and reports.", UUID_EXAMPLES.termId),
      queryParam("classId", "string", "Filter by class/arm ID.", UUID_EXAMPLES.classId),
      queryParam("subjectId", "string", "Filter by subject ID.", UUID_EXAMPLES.subjectId),
      queryParam("studentId", "string", "Filter by student ID.", UUID_EXAMPLES.studentId),
      queryParam("status", "string", "Workflow status filter for assessments, score sheets, broadsheets, or reports.", "PUBLISHED")
    );
  }

  if (lowerPath.includes("/attendance") && listEndpoint) {
    params.push(
      queryParam("date", "string", "Single attendance date in YYYY-MM-DD format.", "2026-04-20"),
      queryParam("dateFrom", "string", "Start date for attendance range filters.", "2026-04-01"),
      queryParam("dateTo", "string", "End date for attendance range filters.", "2026-04-30"),
      queryParam("classId", "string", "Filter attendance by class/arm ID.", UUID_EXAMPLES.classId),
      queryParam("studentId", "string", "Filter attendance by student ID.", UUID_EXAMPLES.studentId),
      queryParam("status", "string", "Attendance status filter.", "PRESENT", ["PRESENT", "ABSENT", "LATE", "EXCUSED"])
    );
  }

  if (lowerPath.includes("/classes") && listEndpoint) {
    params.push(
      queryParam("category", "string", "Filter by Nigerian school category.", "Junior Secondary", ["Early Years", "Primary", "Junior Secondary", "Senior Secondary"]),
      queryParam("level", "string", "Filter by level such as Nursery 1, Primary 4, JSS 2, or SS 1.", "JSS 2"),
      queryParam("has_teacher", "string", "Filter classes by form teacher assignment.", "all", ["yes", "no", "all"]),
      queryParam("academic_year_id", "string", "Academic year used to resolve teacher assignments where applicable.", UUID_EXAMPLES.academicYearId)
    );
  }

  if (lowerPath.includes("/timetable")) {
    params.push(
      queryParam("academicYearId", "string", "Academic year ID for timetable overview/status queries.", UUID_EXAMPLES.academicYearId),
      queryParam("academic_year_id", "string", "Snake-case academic year filter accepted by some timetable endpoints.", UUID_EXAMPLES.academicYearId),
      queryParam("termId", "string", "Academic term ID for timetable queries.", UUID_EXAMPLES.termId),
      queryParam("term_id", "string", "Snake-case term filter accepted by some timetable endpoints.", UUID_EXAMPLES.termId),
      queryParam("category", "string", "Filter timetable classes by school category.", "Senior Secondary")
    );
  }

  if (lowerPath.includes("/finance") && listEndpoint) {
    params.push(
      queryParam("sessionId", "string", "Academic session ID for invoices, fees, and payments.", UUID_EXAMPLES.academicYearId),
      queryParam("termId", "string", "Academic term ID for invoices, fees, and payments.", UUID_EXAMPLES.termId),
      queryParam("classLevelId", "string", "Filter finance records by class level.", UUID_EXAMPLES.classId),
      queryParam("studentId", "string", "Filter finance records by student.", UUID_EXAMPLES.studentId),
      queryParam("status", "string", "Finance workflow status such as PAID, PARTIAL, OVERDUE, or PENDING.", "PAID"),
      queryParam("dateFrom", "string", "Start date for payment/invoice filters.", "2026-01-01"),
      queryParam("dateTo", "string", "End date for payment/invoice filters.", "2026-01-31")
    );
  }

  if (lowerPath.includes("/configuration") && listEndpoint) {
    params.push(
      queryParam("status", "string", "Configuration status filter.", "active", ["active", "inactive", "archived"]),
      queryParam("category", "string", "Configuration category such as General, Finance, Academics, or Others.", "Academics"),
      queryParam("type", "string", "Resource-specific configuration type.", "school_calendar"),
      queryParam("includeInactive", "boolean", "Include inactive configuration records where supported.", "false")
    );
  }

  if (lowerPath.includes("/profile") && listEndpoint) {
    params.push(
      queryParam("status", "string", "Filter profile edit requests, documents, or login history by status.", "pending"),
      queryParam("dateFrom", "string", "Start date for login-history or activity filters.", "2026-04-01"),
      queryParam("dateTo", "string", "End date for login-history or activity filters.", "2026-04-20"),
      queryParam("userId", "string", "Admin-only user filter for profile activity where supported.", UUID_EXAMPLES.userId)
    );
  }

  if (lowerPath.includes("/roles-management") && listEndpoint) {
    params.push(
      queryParam("portalType", "string", "Filter roles/permissions by portal type.", "school", ["school", "student", "parent", "platform"]),
      queryParam("includeSystem", "boolean", "Include built-in system roles when listing roles.", "true"),
      queryParam("userId", "string", "User ID for permission checks or user-role lookups.", UUID_EXAMPLES.userId)
    );
  }

  if (lowerPath.includes("/super-admin") && listEndpoint) {
    params.push(
      queryParam("schoolId", "string", "Platform-level school filter. Only accepted on super-admin routes.", UUID_EXAMPLES.schoolId),
      queryParam("status", "string", "Filter schools, subscriptions, invoices, tickets, or audit logs by status.", "ACTIVE"),
      queryParam("plan", "string", "Subscription plan filter where supported.", "Premium"),
      queryParam("dateFrom", "string", "Start date for platform reports or audit filters.", "2026-01-01"),
      queryParam("dateTo", "string", "End date for platform reports or audit filters.", "2026-01-31")
    );
  }

  if (isExportPath(path)) {
    params.push(
      queryParam("format", "string", "Requested export format when the endpoint supports multiple output types.", "pdf", ["pdf", "csv", "excel"]),
      queryParam("download", "boolean", "When true, hints that the response should be downloaded as an attachment.", "true")
    );
  }

  return dedupeParameters(params);
}

function buildRequestBody(path: string, method: HttpMethod) {
  const example = getRequestExample(path, method);
  return {
    required: method !== "patch",
    description:
      "JSON payload validated by the module service/schema. Unknown fields may be ignored or rejected depending on the endpoint validation rules.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: true,
          example
        },
        examples: {
          realistic: {
            summary: "Realistic SMS request",
            value: example
          }
        }
      }
    }
  };
}

function buildResponses(path: string, method: HttpMethod) {
  if (isExportPath(path)) {
    return {
      "200": {
        description: "File export generated successfully.",
        content: getExportContent(path)
      },
      "400": errorResponse("Invalid export request or unsupported query combination."),
      "401": errorResponse("Authentication is required."),
      "403": errorResponse("The authenticated user does not have access to this export."),
      "404": errorResponse("The requested report/export resource was not found.")
    };
  }

  const responses: Record<string, unknown> = {
    "200": successResponse("Request completed successfully.", getResponseExample(path, method)),
    "400": errorResponse("The request payload, path parameter, or query string failed validation."),
    "401": errorResponse("Authentication is required or the current session is invalid."),
    "403": errorResponse("The authenticated user does not have the required role or permission."),
    "404": errorResponse("The requested resource was not found in the current school scope.")
  };

  if (method === "post") {
    responses["201"] = successResponse("Resource created or workflow action accepted.", getResponseExample(path, method));
  }

  if (path.toLowerCase().includes("assign") || path.toLowerCase().includes("conflict")) {
    responses["409"] = errorResponse("The request conflicts with an existing assignment or business rule.");
  }

  return responses;
}

function getRequestExample(path: string, method: HttpMethod) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.includes("/auth/login")) {
    return {
      email: "principal@futureacademy.ng",
      password: "StrongPassword123!"
    };
  }
  if (lowerPath.includes("/staff") && method === "post") {
    return {
      firstName: "Ngozi",
      lastName: "Adeyemi",
      email: "ngozi.adeyemi@futureacademy.ng",
      phone: "+2348012345678",
      staffType: "ACADEMIC",
      designation: "Mathematics Teacher",
      departmentId: UUID_EXAMPLES.id,
      role: "TEACHER",
      employmentType: "FULL_TIME",
      canLogin: true
    };
  }
  if (lowerPath.includes("/staff") && lowerPath.includes("/status")) {
    return {
      status: "SUSPENDED",
      reason: "Pending HR review"
    };
  }
  if (lowerPath.includes("/staff") && lowerPath.includes("/roles")) {
    return {
      roleIds: [UUID_EXAMPLES.roleId],
      reason: "Promoted to Head of Department"
    };
  }
  if (lowerPath.includes("/profile") && lowerPath.includes("/edit-requests")) {
    return {
      fields: [
        { field: "phone", oldValue: "+2348000000000", newValue: "+2348012345678" }
      ],
      reason: "Updated primary phone number"
    };
  }
  if (lowerPath.includes("/profile") && lowerPath.includes("/documents")) {
    return {
      title: "TRCN Certificate",
      type: "certificate",
      fileUrl: "https://cdn.futureacademy.ng/documents/trcn-certificate.pdf",
      notes: "Verified by HR"
    };
  }
  if (lowerPath.includes("/students") && method === "post") {
    return {
      firstName: "David",
      lastName: "Okafor",
      admissionNumber: "FRS/2026/0012",
      classId: UUID_EXAMPLES.classId,
      gender: "MALE",
      dateOfBirth: "2014-05-12",
      guardianPhone: "+2348012345678"
    };
  }
  if (lowerPath.includes("/classes") && lowerPath.includes("assign-teacher")) {
    return {
      classTeacherId: UUID_EXAMPLES.teacherId,
      assistantClassTeacherId: UUID_EXAMPLES.userId,
      academicYearId: UUID_EXAMPLES.academicYearId,
      termId: UUID_EXAMPLES.termId
    };
  }
  if (lowerPath.includes("/classes") && method === "post") {
    return {
      name: "JSS 2 A",
      shortName: "J2A",
      level: "JSS 2",
      section: "A",
      category: "Junior Secondary",
      arm: "Section A",
      capacity: 40,
      room: "Block B Room 3",
      displayOrder: 24
    };
  }
  if (lowerPath.includes("/timetable") && lowerPath.includes("/slot")) {
    return {
      dayOfWeek: 3,
      periodNumber: 7,
      subjectId: UUID_EXAMPLES.subjectId,
      teacherId: UUID_EXAMPLES.teacherId,
      room: "Science Lab",
      slotType: "lesson",
      isDoublePeriod: false,
      notes: "Practical class"
    };
  }
  if (lowerPath.includes("/timetable") && lowerPath.includes("/publish")) {
    return {
      action: "publish",
      termId: UUID_EXAMPLES.termId
    };
  }
  if (lowerPath.includes("/academics/subjects") && lowerPath.includes("assign-teacher")) {
    return {
      classId: UUID_EXAMPLES.classId,
      teacherId: UUID_EXAMPLES.teacherId,
      applyToAllArms: true,
      reason: "Departmental timetable update"
    };
  }
  if (lowerPath.includes("/academics/subjects")) {
    return {
      name: "English Language",
      code: "ENG",
      waecCode: "ENG",
      departmentId: UUID_EXAMPLES.id,
      classLevels: ["JSS 1", "JSS 2", "JSS 3"],
      isCompulsory: true,
      isWaecSubject: true,
      periodsPerWeek: 5
    };
  }
  if (lowerPath.includes("/academics") && lowerPath.includes("scores")) {
    return {
      assessmentId: UUID_EXAMPLES.assessmentId,
      classId: UUID_EXAMPLES.classId,
      subjectId: UUID_EXAMPLES.subjectId,
      scores: [
        { studentId: UUID_EXAMPLES.studentId, caScore: 28, examScore: 62 }
      ]
    };
  }
  if (lowerPath.includes("/admissions") && method === "post" && !lowerPath.includes("{")) {
    return {
      applicantFirstName: "Amina",
      applicantLastName: "Bello",
      intendedClassLevelId: UUID_EXAMPLES.classId,
      parentName: "Mrs. Hauwa Bello",
      parentPhone: "+2348012345678",
      parentEmail: "hauwa.bello@example.com"
    };
  }
  if (lowerPath.includes("/admissions") && lowerPath.includes("/review")) {
    return {
      status: "UNDER_REVIEW",
      reviewComment: "Application documents are complete."
    };
  }
  if (lowerPath.includes("/admissions") && lowerPath.includes("/decision")) {
    return {
      decision: "APPROVED",
      comment: "Approved for admission into JSS 1."
    };
  }
  if (lowerPath.includes("/finance") && lowerPath.includes("fee-structures")) {
    return {
      name: "JSS 1 First Term Tuition",
      classLevelId: UUID_EXAMPLES.classId,
      termId: UUID_EXAMPLES.termId,
      amount: 125000,
      currency: "NGN",
      isMandatory: true,
      dueDate: "2026-09-30"
    };
  }
  if (lowerPath.includes("/finance") && lowerPath.includes("manual-payment")) {
    return {
      invoiceId: UUID_EXAMPLES.invoiceId,
      amount: 50000,
      paymentDate: "2026-04-20",
      method: "BANK_TRANSFER",
      reference: "GTB-TRF-884102"
    };
  }
  if (lowerPath.includes("/attendance")) {
    return {
      classId: UUID_EXAMPLES.classId,
      date: "2026-04-20",
      records: [
        { studentId: UUID_EXAMPLES.studentId, status: "PRESENT", remarks: "On time" }
      ]
    };
  }
  if (lowerPath.includes("/roles-management") && lowerPath.includes("assign")) {
    return {
      userId: UUID_EXAMPLES.userId,
      roleIds: [UUID_EXAMPLES.roleId],
      reason: "Assign admissions officer permissions"
    };
  }
  if (lowerPath.includes("/communications")) {
    return {
      title: "PTA Meeting Reminder",
      body: "PTA meeting holds on Friday by 2:00 PM in the school hall.",
      audience: "parents",
      publishAt: "2026-04-24T13:00:00.000Z"
    };
  }
  if (lowerPath.includes("/operations") && lowerPath.includes("visitors")) {
    return {
      visitorName: "Mr. Chinedu Nwosu",
      phone: "+2348012345678",
      purpose: "Parent meeting",
      hostStaffId: UUID_EXAMPLES.staffId
    };
  }
  if (lowerPath.includes("/super-admin") && lowerPath.includes("schools")) {
    return {
      name: "Future Academy Abuja",
      code: "FAA",
      ownerEmail: "owner@futureacademy.ng",
      phone: "+2348012345678",
      plan: "Premium"
    };
  }

  return {
    note: "Provide the resource fields required by this workflow.",
    referenceId: UUID_EXAMPLES.id
  };
}

function getResponseExample(path: string, method: HttpMethod) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/auth/session") || lowerPath.includes("/auth/login")) {
    return {
      ok: true,
      data: {
        user: {
          userId: UUID_EXAMPLES.userId,
          schoolId: UUID_EXAMPLES.schoolId,
          email: "principal@futureacademy.ng",
          role: "PRINCIPAL",
          portalType: "school"
        }
      }
    };
  }
  if (isLikelyListEndpoint(path) && method === "get") {
    return {
      ok: true,
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    };
  }
  return {
    ok: true,
    success: true,
    message: method === "delete" ? "Resource archived successfully." : "Request completed successfully.",
    data: {}
  };
}

function successResponse(description: string, example: unknown) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
        examples: {
          success: {
            summary: "Successful response",
            value: example
          }
        }
      }
    }
  };
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
        examples: {
          error: {
            summary: "Error response",
            value: {
              ok: false,
              error: description
            }
          }
        }
      }
    }
  };
}

function getExportContent(path: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/csv")) {
    return {
      "text/csv": {
        schema: { type: "string", example: "student,subject,total,grade\nDavid Okafor,Mathematics,82,A1" }
      }
    };
  }
  if (lowerPath.includes("/excel")) {
    return {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        schema: { type: "string", format: "binary" }
      }
    };
  }
  return {
    "application/pdf": {
      schema: { type: "string", format: "binary" }
    }
  };
}

function mergeParameters(existing: Array<Record<string, unknown>>, additions: Array<Record<string, unknown>>) {
  return dedupeParameters([...existing, ...additions]);
}

function mergeResponses(existing: Record<string, unknown>, additions: Record<string, unknown>) {
  const merged = { ...additions };

  Object.entries(existing).forEach(([status, response]) => {
    merged[status] = isMeaningfulResponse(response) ? response : additions[status] ?? response;
  });

  return merged;
}

function isMeaningfulResponse(response: unknown) {
  if (!response || typeof response !== "object") return false;
  const responseRecord = response as Record<string, unknown>;
  const description = responseRecord.description;
  return Boolean(
    (typeof description === "string" && description.trim().length > 0) ||
      responseRecord.content ||
      responseRecord.headers
  );
}

function queryParam(
  name: string,
  type: "string" | "integer" | "boolean",
  description: string,
  example: string | number,
  enumValues?: string[]
) {
  return {
    name,
    in: "query",
    required: false,
    schema: {
      type,
      ...(enumValues ? { enum: enumValues } : {})
    },
    example,
    description
  };
}

function dedupeParameters(parameters: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return parameters.filter((parameter) => {
    const key = `${String(parameter.in)}:${String(parameter.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function describePathParameter(name: string) {
  const pretty = toTitleCase(name.replace(/Id$/, " ID"));
  if (name.toLowerCase().includes("student")) return `${pretty} scoped to the current school or portal relationship.`;
  if (name.toLowerCase().includes("staff") || name.toLowerCase().includes("teacher")) return `${pretty} for a school staff/teacher record.`;
  if (name.toLowerCase().includes("class")) return `${pretty} for a Nigerian class arm such as JSS 2 A or SS 1 Science.`;
  if (name.toLowerCase().includes("school")) return `${pretty}; only platform/super-admin routes may use cross-school IDs.`;
  return `${pretty} identifying the target resource.`;
}

function getAuthorizationNote(path: string, method: HttpMethod) {
  if (isPublicEndpoint(path, method)) return "No role or permission is required.";
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/staff")) return "Requires the relevant staff.* permission such as staff.view, staff.create, staff.update, staff.assign_roles, staff.manage_status, or staff.delete.";
  if (lowerPath.includes("/profile")) return "Self routes require profile self-service access; admin profile routes require profiles.* permissions such as profiles.view, profiles.update, profiles.review_edit_requests, or profiles.view_login_history.";
  if (lowerPath.includes("/timetable")) return "Requires timetable.* permissions for admin actions, while students, parents, class teachers, and subject teachers are scoped to their published or assigned timetables.";
  if (lowerPath.includes("/classes")) return "Requires classes.* permissions; class teachers and subject teachers may be narrowed to their own assigned classes.";
  if (lowerPath.includes("/academics/subjects")) return "Requires subjects.* permissions for CRUD/teacher assignment and academic role access for read operations.";
  if (lowerPath.includes("/academics")) return "Requires academic/exam/result roles declared on the controller, such as Principal, VP Academics, Exam Officer, HOD, Class Teacher, or Subject Teacher depending on the workflow.";
  if (lowerPath.includes("/finance")) return "Requires finance/accounting roles declared on the controller; school users are limited to their school's finance records.";
  if (lowerPath.includes("/admissions")) return "Requires admissions roles declared on the controller; parents may only access their own admission applications where supported.";
  if (lowerPath.includes("/roles-management")) return "Requires roles/permissions management access. Assignment actions are audited and must not bypass role scope.";
  if (lowerPath.includes("/super-admin")) return "Requires platform Super Admin access.";
  if (lowerPath.includes("/teacher-portal")) return "Teacher portal only; requires a teacher session.";
  if (lowerPath.includes("/student-portal")) return "Student portal only; requires a student session.";
  if (lowerPath.includes("/parent-portal")) return "Parent portal only; requires a parent session with linked child access.";
  return "Requires the roles or permissions declared on the controller method. The backend enforces this with guards before service logic runs.";
}

function getTenantScope(path: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("/super-admin")) {
    return "Platform scope. Super admin users may query across schools where the endpoint exposes school filters.";
  }
  if (lowerPath.includes("/parent-portal")) {
    return "Parent scope. Data is limited to the authenticated parent and linked children.";
  }
  if (lowerPath.includes("/student-portal")) {
    return "Student scope. Data is limited to the authenticated student.";
  }
  if (lowerPath.includes("/teacher-portal")) {
    return "Teacher scope. Data is limited to the authenticated teacher's assignments.";
  }
  return "School scope. Data is automatically filtered to the authenticated user's schoolId.";
}

function isPublicEndpoint(path: string, method: HttpMethod) {
  const lowerPath = path.toLowerCase();
  return lowerPath.includes("/auth/login") || (lowerPath.includes("/auth/logout") && method === "post");
}

function shouldDocumentRequestBody(path: string, method: HttpMethod) {
  const lowerPath = path.toLowerCase();
  if (method === "get" || method === "delete") return false;
  if (lowerPath.includes("/auth/logout")) return false;
  if (lowerPath.includes("/staff-attendance/clock-in")) return false;
  if (lowerPath.includes("/staff-attendance/clock-out")) return false;
  if (lowerPath.includes("/academic-assessments/") && lowerPath.endsWith("/candidates")) return false;
  if (lowerPath.includes("/admissions/") && lowerPath.endsWith("/submit")) return false;
  if (lowerPath.includes("/staff-leave/") && (lowerPath.endsWith("/approve") || lowerPath.endsWith("/reject"))) return false;
  return true;
}

function isExportPath(path: string) {
  const lowerPath = path.toLowerCase();
  return lowerPath.includes("/pdf") || lowerPath.includes("/csv") || lowerPath.includes("/excel") || lowerPath.includes("offer-letter");
}

function isLikelyListEndpoint(path: string) {
  const segments = getRawResourceSegments(path);
  const last = segments.at(-1) ?? "";
  if (isExportPath(path)) return false;
  if (last.includes("{")) return false;
  if (["metrics", "dashboard", "overview", "analytics", "session", "settings", "my", "me"].includes(last)) return false;
  return true;
}

function hasPathParameter(path: string) {
  return /\{[^}]+\}/.test(path);
}

function isParameterSegment(segment: string) {
  return segment.startsWith("{") && segment.endsWith("}");
}

function isActionSegment(segment: string) {
  return [
    "accept-offer",
    "approve",
    "assign",
    "assign-teacher",
    "clock-in",
    "clock-out",
    "compile",
    "complete",
    "decision",
    "decline-offer",
    "enroll",
    "financial-clearance",
    "generate",
    "issue-offer",
    "publish",
    "publish-all",
    "recommend",
    "register",
    "reject",
    "review",
    "submit",
    "unpublish",
    "verify-fee"
  ].includes(segment);
}

function getResourceSegments(path: string) {
  return getRawResourceSegments(path)
    .map((segment) => segment.replace(/[{}]/g, ""));
}

function getRawResourceSegments(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "api" && segment !== "v1");
}

function buildOperationId(method: HttpMethod, path: string) {
  const parts = getResourceSegments(path).map((segment) => toPascalCase(segment));
  return `${method}${parts.join("")}`;
}

function toTitleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function toPascalCase(value: string) {
  return toTitleCase(value).replace(/\s/g, "");
}
