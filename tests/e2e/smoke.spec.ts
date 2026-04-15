import { expect, test, type Page } from "@playwright/test";

const password = "FutureRealm123!";

async function waitForApi(page: Page) {
  await expect
    .poll(
      async () => {
        try {
          const response = await page.request.post("/api/v1/auth/login", {
            data: { email: "not-a-demo-user@greenfieldcollege.ng", password }
          });
          return response.status();
        } catch {
          return 0;
        }
      },
      { timeout: 20_000 }
    )
    .toBe(401);
}

async function loginAs(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", {
    data: { email, password }
  });

  expect(response.ok()).toBeTruthy();
}

async function getCsrfToken(page: Page) {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === "fr_csrf")?.value;
  expect(token).toBeTruthy();
  return token!;
}

async function postWorkflowAction<T>(
  page: Page,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await page.request.post(endpoint, {
    data: payload,
    headers: {
      "x-csrf-token": await getCsrfToken(page)
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  expect(body.error).toBeUndefined();
  expect(body.ok).toBeTruthy();
  expect(body.data).toBeTruthy();
  return body.data!;
}

test("principal can sign in and reach dashboard", async ({ page }) => {
  await waitForApi(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill("principal@greenfieldcollege.ng");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "Admin command centre" })).toBeVisible();
  await expect(page.getByText("Pending actions")).toBeVisible();
});

test("student can sign in and use the student portal", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@greenfieldcollege.ng");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/portals\/student/);
  await expect(page.getByRole("heading", { name: /school week|track this week's classes/i })).toBeVisible();

  await page.goto("/portals/student/results");
  await expect(page.getByRole("heading", { name: "My results" })).toBeVisible();
  await expect(page.getByText(/Only published result sheets/i)).toBeVisible();

  await page.goto("/portals/student/profile");
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daniel Yusuf", exact: true })).toBeVisible();
});

test("parent can switch children and view results and fees", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("parent@greenfieldcollege.ng");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/portals\/parent/);
  await expect(page.getByRole("heading", { name: /children|family view|school progress/i }).first()).toBeVisible();

  await page.goto("/portals/parent/children");
  await expect(page.getByRole("heading", { name: "My children" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Daniel Yusuf/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Maryam Yusuf/ })).toBeVisible();

  await page.getByRole("link", { name: /Daniel Yusuf/ }).click();
  await expect(page.getByRole("heading", { name: "Daniel Yusuf" })).toBeVisible();

  await page.getByRole("link", { name: "Results", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Child results" })).toBeVisible();
  await expect(page.getByText(/Only published result sheets/i)).toBeVisible();

  await page.getByRole("link", { name: "Back to child overview" }).click();
  await page.getByRole("link", { name: "Fees", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Child fees" })).toBeVisible();
  await expect(page.getByText(/Read-only invoice and payment records/i)).toBeVisible();
});

test("teacher can use timetable, attendance, scores, and assignments", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("teacher@greenfieldcollege.ng");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/portals\/teacher/);
  await expect(page.getByRole("heading", { name: /manage science and mathematics|manage your classes/i })).toBeVisible();

  await page.goto("/portals/teacher/timetable");
  await expect(page.getByRole("heading", { name: "My timetable" })).toBeVisible();

  await page.goto("/portals/teacher/attendance");
  await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save attendance" })).toBeVisible();

  await page.goto("/portals/teacher/scores");
  await expect(page.getByRole("heading", { name: "Score entry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save score" })).toBeVisible();

  await page.goto("/portals/teacher/assignments");
  await expect(page.getByRole("heading", { name: "Assignments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create assignment" })).toBeVisible();

  await page.goto("/portals/teacher/curriculum");
  await expect(page.getByRole("heading", { name: "My Scheme of Work" })).toBeVisible();

  await page.goto("/portals/teacher/staff-attendance");
  await expect(page.getByRole("heading", { name: "My Clock-In / Clock-Out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible();

  await page.goto("/portals/teacher/training");
  await expect(page.getByRole("heading", { name: "My Training & CPD" })).toBeVisible();
});

test("restricted routes cannot expose unauthorized workspaces", async ({ page }) => {
  await loginAs(page, "teacher@greenfieldcollege.ng");
  await page.goto("/finance");
  if (new URL(page.url()).pathname === "/finance") {
    await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
    await page.getByRole("link", { name: "Go to allowed workspace" }).click();
  }
  await expect(page).toHaveURL(/portals\/teacher/);
  await expect(page.getByRole("heading", { name: /manage science and mathematics|manage your classes/i })).toBeVisible();

  await loginAs(page, "student@greenfieldcollege.ng");
  await page.goto("/settings");
  if (new URL(page.url()).pathname === "/settings") {
    await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
    await page.getByRole("link", { name: "Go to allowed workspace" }).click();
  }
  await expect(page).toHaveURL(/portals\/student/);
  await expect(page.getByRole("heading", { name: /school week|track this week's classes/i })).toBeVisible();
});

test("principal can use result workflow pages", async ({ page }) => {
  await loginAs(page, "principal@greenfieldcollege.ng");

  await page.goto("/academics/results");
  await expect(page.getByRole("heading", { name: "Result workflow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Approvals" })).toBeVisible();

  await page.goto("/academics/results/assessments");
  await expect(page.getByRole("heading", { name: "Assessment setup and marking" })).toBeVisible();
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: /Second Term Mathematics Test 2/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidate score sheet" })).toBeVisible();

  await page.goto("/academics/results/settings");
  await expect(page.getByRole("heading", { name: "Grading and assessment setup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save scheme" })).toBeVisible();

  await page.goto("/academics/results/approvals");
  await expect(page.getByRole("heading", { name: "Approval queue" })).toBeVisible();

  await page.goto("/academics/results/publish");
  await expect(page.getByRole("heading", { name: "Compile and publish results" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();

  await page.goto("/academics/results/analytics");
  await expect(page.getByRole("heading", { name: "Result analytics" })).toBeVisible();

  await page.goto("/academics/results/broadsheets");
  await expect(page.getByRole("heading", { name: "Broadsheet compilation" })).toBeVisible();
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/academics\/results\/broadsheets\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /JSS 2 - Gold broadsheet/i })).toBeVisible();
  await expect(page.getByText("Approval timeline")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export PDF" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export Excel" })).toBeVisible();

  await page.goto("/academics/curriculum");
  await expect(page.getByRole("heading", { name: "Scheme of Work" })).toBeVisible();

  await page.goto("/teachers/attendance");
  await expect(page.getByRole("heading", { name: "Teacher Attendance" })).toBeVisible();

  await page.goto("/teachers/training");
  await expect(page.getByRole("heading", { name: "Teacher Training & CPD" })).toBeVisible();
});

test("bursar can use the finance dashboard and payment pages", async ({ page }) => {
  await loginAs(page, "bursar@greenfieldcollege.ng");
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Fees, payments, and clearance" })).toBeVisible();
  await expect(page.getByText("Total billed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Payments", exact: true })).toBeVisible();

  await page.goto("/finance/payments");
  await expect(page.getByRole("heading", { name: "Payments and adjustments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
});

test("multi-role admissions lifecycle reaches enrollment", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);

  await loginAs(page, "admissions@greenfieldcollege.ng");
  const created = await postWorkflowAction<{ id: string; desiredClass: string; studentName: string }>(
    page,
    "/api/v1/admissions",
    {
      firstName: "E2E",
      lastName: `Applicant${suffix}`,
      guardianName: "Test Guardian",
      guardianPhone: `0803${suffix}`,
      guardianEmail: `guardian${suffix}@example.com`,
      desiredClass: "JSS 1 - Silver",
      gender: "MALE",
      dateOfBirth: "2014-02-10",
      previousSchool: "Demo Preparatory School"
    }
  );

  const reviewed = await postWorkflowAction<{ status: string }>(page, `/api/v1/admissions/${created.id}/review`, {
    recommendedClass: created.desiredClass,
    documentStatus: "Documents complete",
    screeningOutcome: "Ready for screening",
    notes: "Applicant biodata, guardian details, and class fit verified."
  });
  expect(reviewed.status).toBe("REVIEWING");

  await loginAs(page, "bursar@greenfieldcollege.ng");
  const feeVerified = await postWorkflowAction<{ status: string; applicationFeeStatus?: string }>(
    page,
    `/api/v1/admissions/${created.id}/verify-fee`,
    {
      amount: 10000,
      reference: `E2E-FEE-${suffix}`,
      waived: false,
      note: "Application fee verified."
    }
  );
  expect(feeVerified.applicationFeeStatus).toBe("VERIFIED");

  await loginAs(page, "admissions@greenfieldcollege.ng");
  const screening = await postWorkflowAction<{ status: string }>(
    page,
    `/api/v1/admissions/${created.id}/schedule-screening`,
    {
      scheduledAt: "2026-04-20",
      venue: "ICT Lab",
      note: "Screening scheduled."
    }
  );
  expect(screening.status).toBe("SCREENING_SCHEDULED");

  const screened = await postWorkflowAction<{ status: string }>(
    page,
    `/api/v1/admissions/${created.id}/screening-result`,
    {
      score: 84,
      maxScore: 100,
      result: "PASS",
      recommendation: "Recommend for admission",
      remarks: "Good literacy and numeracy readiness."
    }
  );
  expect(screened.status).toBe("SCREENING_COMPLETED");

  const recommended = await postWorkflowAction<{ status: string }>(
    page,
    `/api/v1/admissions/${created.id}/recommend`,
    {
      notes: "Recommended after complete documents and screening."
    }
  );
  expect(recommended.status).toBe("RECOMMENDED");

  await loginAs(page, "principal@greenfieldcollege.ng");
  const approved = await postWorkflowAction<{ status: string }>(page, `/api/v1/admissions/${created.id}/decision`, {
    decision: "APPROVED",
    notes: "Approved for admission."
  });
  expect(approved.status).toBe("APPROVED");

  await loginAs(page, "admissions@greenfieldcollege.ng");
  const offered = await postWorkflowAction<{ id: string; status: string; offerStatus?: string }>(
    page,
    `/api/v1/admissions/${created.id}/issue-offer`,
    {
      checklist: "Acceptance fee, Passport photograph",
      expiryDays: 14
    }
  );
  expect(offered.status).toBe("OFFER_SENT");

  const accepted = await postWorkflowAction<{ status: string }>(
    page,
    `/api/v1/admissions/${created.id}/accept-offer`,
    {
      note: "Guardian accepted the admission offer."
    }
  );
  expect(accepted.status).toBe("ACCEPTED");

  await loginAs(page, "bursar@greenfieldcollege.ng");
  const cleared = await postWorkflowAction<{ status: string }>(
    page,
    `/api/v1/admissions/${created.id}/financial-clearance`,
    {
      amount: 50000,
      reference: `E2E-CLEAR-${suffix}`,
      waived: false,
      note: "Acceptance deposit verified."
    }
  );
  expect(cleared.status).toBe("FINANCIALLY_CLEARED");

  await loginAs(page, "admin.officer@greenfieldcollege.ng");
  const enrolled = await postWorkflowAction<{ fullName: string; className: string; status: string }>(
    page,
    `/api/v1/admissions/${created.id}/enroll`,
    {
      className: created.desiredClass,
      guardianRelationship: "Parent",
      portalAccountsCreated: true
    }
  );

  expect(enrolled.fullName).toBe(created.studentName);
  expect(enrolled.className).toBe(created.desiredClass);
  expect(enrolled.status).toBe("ACTIVE");
});
