import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "management-dashboard-route-test-secret"

/** 基準時刻。当月 = 2026-06、直近 30 日の下限 = 2026-05-16。 */
const now = "2026-06-15T00:00:00.000Z"

const managementDashboardSchema = z.object({
  employee_count: z.number(),
  department_headcounts: z.array(
    z.object({ department_name: z.string().nullable(), headcount: z.number() }),
  ),
  recent_join_count: z.number(),
  recent_retire_count: z.number(),
  attendance_record_count: z.number(),
  leave_request_count: z.number(),
  leave_pending_count: z.number(),
  expense_count: z.number(),
  expense_pending_count: z.number(),
  open_review_cycle_count: z.number(),
  pending_application_count: z.number(),
  goal_done_rates: z.array(
    z.object({
      period: z.string(),
      total: z.number(),
      done: z.number(),
      done_rate: z.number(),
    }),
  ),
})

const managementEmployees = [
  { id: 1, code: "E001", name: "Admin", email: "you+e001@example.com", role: "admin", dept: "HR" },
  {
    id: 2,
    code: "E002",
    name: "Member",
    email: "you+e002@example.com",
    role: "member",
    dept: "Sales",
  },
  {
    id: 3,
    code: "E003",
    name: "Two",
    email: "you+e003@example.com",
    role: "member",
    dept: "Sales",
  },
  {
    id: 4,
    code: "E004",
    name: "Gone",
    email: "you+e004@example.com",
    role: "member",
    dept: "Sales",
  },
]

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    managementEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: null,
      dept_name: employee.dept,
      position: null,
      // E004 は退職済み(在籍数に数えない)。
      status: employee.id === 4 ? "retired" : "active",
    })),
  )

  await seedIamForEmployees(
    db,
    managementEmployees.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  // 入社 2 件(直近 30 日以内)、退職 1 件(直近)、入社 1 件(30 日より前=数えない)。
  await seedD1(db, "employee_events", [
    {
      id: 1,
      employee_id: 2,
      kind: "join",
      effective_date: "2026-06-01",
      from_department_code: null,
      to_department_code: "D002",
      note: null,
      created_at: "2026-06-01T00:00:00.000Z",
    },
    {
      id: 2,
      employee_id: 3,
      kind: "join",
      effective_date: "2026-05-20",
      from_department_code: null,
      to_department_code: "D002",
      note: null,
      created_at: "2026-05-20T00:00:00.000Z",
    },
    {
      id: 3,
      employee_id: 4,
      kind: "retire",
      effective_date: "2026-06-10",
      from_department_code: "D002",
      to_department_code: null,
      note: null,
      created_at: "2026-06-10T00:00:00.000Z",
    },
    {
      id: 4,
      employee_id: 1,
      kind: "join",
      effective_date: "2026-04-01",
      from_department_code: null,
      to_department_code: "D001",
      note: null,
      created_at: "2026-04-01T00:00:00.000Z",
    },
  ])

  // 当月の打刻 2 件、前月 1 件(数えない)。
  await seedD1(db, "attendance_records", [
    { id: 1, employee_id: 2, work_date: "2026-06-02", status: "closed" },
    { id: 2, employee_id: 2, work_date: "2026-06-03", status: "closed" },
    { id: 3, employee_id: 2, work_date: "2026-05-30", status: "closed" },
  ])

  // 休暇: 当月 2 件(うち pending 1)、前月 pending 1(件数は当月外だが pending は全期間)。
  await seedD1(db, "leave_requests", [
    {
      id: 1,
      employee_id: 2,
      leave_type: "annual",
      start_date: "2026-06-20",
      end_date: "2026-06-21",
      days: 2,
      reason: null,
      status: "pending",
      approver_id: null,
      decided_comment: null,
      created_at: "2026-06-05T00:00:00.000Z",
    },
    {
      id: 2,
      employee_id: 3,
      leave_type: "annual",
      start_date: "2026-06-22",
      end_date: "2026-06-22",
      days: 1,
      reason: null,
      status: "approved",
      approver_id: 1,
      decided_comment: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    {
      id: 3,
      employee_id: 3,
      leave_type: "annual",
      start_date: "2026-05-10",
      end_date: "2026-05-10",
      days: 1,
      reason: null,
      status: "pending",
      approver_id: null,
      decided_comment: null,
      created_at: "2026-05-01T00:00:00.000Z",
    },
  ])

  // 経費: 当月 2 件(うち pending 1)、前月 1 件。
  await seedD1(db, "expenses", [
    {
      id: 1,
      employee_id: 2,
      category: "transport",
      amount: 1000,
      spent_at: "2026-06-01",
      note: null,
      status: "pending",
      created_at: "2026-06-02T00:00:00.000Z",
    },
    {
      id: 2,
      employee_id: 3,
      category: "supplies",
      amount: 2000,
      spent_at: "2026-06-03",
      note: null,
      status: "approved",
      created_at: "2026-06-04T00:00:00.000Z",
    },
    {
      id: 3,
      employee_id: 3,
      category: "books",
      amount: 500,
      spent_at: "2026-05-01",
      note: null,
      status: "pending",
      created_at: "2026-05-02T00:00:00.000Z",
    },
  ])

  // 評価サイクル: open 2 / closed 1。
  await seedD1(db, "review_cycles", [
    { id: 1, title: "C1", period: "2026-H1", status: "open", due_date: null },
    { id: 2, title: "C2", period: "2026-H1", status: "open", due_date: null },
    { id: 3, title: "C3", period: "2025-H2", status: "closed", due_date: null },
  ])

  // 目標: 2026-H1 は 3 件中 done 1 (rate 1/3)、2025-H2 は 1 件中 done 1 (rate 1)。
  await seedD1(db, "goals", [
    {
      id: 1,
      employee_id: 2,
      period: "2026-H1",
      title: "g1",
      kpi: null,
      weight: 10,
      status: "done",
    },
    {
      id: 2,
      employee_id: 2,
      period: "2026-H1",
      title: "g2",
      kpi: null,
      weight: 10,
      status: "in_progress",
    },
    {
      id: 3,
      employee_id: 3,
      period: "2026-H1",
      title: "g3",
      kpi: null,
      weight: 10,
      status: "draft",
    },
    {
      id: 4,
      employee_id: 3,
      period: "2025-H2",
      title: "g4",
      kpi: null,
      weight: 10,
      status: "done",
    },
  ])

  // 申請テンプレートと申請(pending 2 / approved 1)。
  await seedD1(db, "application_templates", [
    {
      id: 1,
      code: "T1",
      name: "Tmpl",
      category: "general",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
  ])

  await seedD1(db, "applications", [
    {
      id: 1,
      template_id: 1,
      applicant_id: 2,
      status: "pending",
      current_step: null,
      payload: "{}",
      created_at: "2026-06-01T00:00:00.000Z",
    },
    {
      id: 2,
      template_id: 1,
      applicant_id: 3,
      status: "pending",
      current_step: null,
      payload: "{}",
      created_at: "2026-06-02T00:00:00.000Z",
    },
    {
      id: 3,
      template_id: 1,
      applicant_id: 2,
      status: "approved",
      current_step: null,
      payload: "{}",
      created_at: "2026-06-03T00:00:00.000Z",
    },
  ])

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

describe("GET /dashboard/management", () => {
  test("returns 200 with deterministic aggregated counts", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/dashboard/management",
      token: await tokenFor(1, "admin"),
      now,
    })

    expect(response.status).toBe(200)

    const parsed = managementDashboardSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const summary = parsed.data

      expect(summary.employee_count).toBe(3)
      expect(summary.recent_join_count).toBe(2)
      expect(summary.recent_retire_count).toBe(1)
      expect(summary.attendance_record_count).toBe(2)
      expect(summary.leave_request_count).toBe(2)
      expect(summary.leave_pending_count).toBe(2)
      expect(summary.expense_count).toBe(2)
      expect(summary.expense_pending_count).toBe(2)
      expect(summary.open_review_cycle_count).toBe(2)
      expect(summary.pending_application_count).toBe(2)

      const salesHeadcount = summary.department_headcounts.find(
        (row) => row.department_name === "Sales",
      )

      expect(salesHeadcount?.headcount).toBe(2)

      const h1 = summary.goal_done_rates.find((row) => row.period === "2026-H1")

      expect(h1?.total).toBe(3)
      expect(h1?.done).toBe(1)
      expect(h1?.done_rate).toBeCloseTo(1 / 3, 5)

      const h2 = summary.goal_done_rates.find((row) => row.period === "2025-H2")

      expect(h2?.done_rate).toBe(1)
    }
  })

  test("returns 403 for a member without management_dashboard:view", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/dashboard/management",
      token: await tokenFor(2, "member"),
      now,
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/dashboard/management",
      token: null,
      now,
    })

    expect(response.status).toBe(401)
  })
})
