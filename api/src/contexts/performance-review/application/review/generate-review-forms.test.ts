import { generateReviewForms } from "@/contexts/performance-review/application/review/generate-review-forms"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { verifyCompanyMigrationFixture } from "@/api/test/support/verify-company-migration-fixture"
import { describe, expect, test } from "bun:test"

describe("generateReviewForms", () => {
  test("fails closed instead of reading legacy organization memberships", async () => {
    const { context, db } = createTestContext()
    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", dept_id: 1, status: "active" },
      { id: 5, code: "E005", name: "Member", dept_id: 1, status: "active" },
    ])
    await seedD1(db, "org_memberships", [
      { department_code: "D001", employee_code: "E005", manager_employee_code: "E002" },
    ])

    const generated = await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: true,
        include_subordinates: true,
        peer_count: 0,
      },
    })

    expect(generated).toBeInstanceOf(Error)
    const count = await db.prepare("SELECT COUNT(*) AS total FROM review_forms").first<{
      total: number
    }>()
    expect(count?.total).toBe(0)
  })

  test("creates self, manager, peer and subordinate assignments from the organization", async () => {
    const { context, db } = createTestContext()
    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", dept_id: 1, status: "active" },
      { id: 5, code: "E005", name: "Member A", dept_id: 3, status: "active" },
      { id: 6, code: "E006", name: "Member B", dept_id: 3, status: "active" },
      { id: 9, code: "E009", name: "Inactive", dept_id: 3, status: "retired" },
    ])
    await seedD1(db, "org_memberships", [
      { department_code: "D001", employee_code: "E002", manager_employee_code: null },
      { department_code: "D003", employee_code: "E005", manager_employee_code: "E002" },
      { department_code: "D003", employee_code: "E006", manager_employee_code: "E002" },
    ])
    await seedD1(db, "review_cycles", [
      { id: 1, title: "Review", period: "2026-H1", status: "draft", due_date: null },
    ])
    await verifyCompanyMigrationFixture({
      db,
      departments: [
        { id: 1, code: "D001", name: "Headquarters", managerEmployeeCode: "E002" },
        { id: 3, code: "D003", name: "Team" },
      ],
    })

    const generated = await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: true,
        include_subordinates: true,
        peer_count: 0,
      },
    })
    expect(generated).toBe(9)

    const rows = await db.prepare("SELECT * FROM review_forms ORDER BY id").all()
    expect(rows.results).toHaveLength(9)
    expect(rows.results).toContainEqual(
      expect.objectContaining({
        subject_employee_id: 5,
        reviewer_employee_id: 2,
        reviewer_type: "manager",
      }),
    )
    expect(rows.results).toContainEqual(
      expect.objectContaining({
        subject_employee_id: 2,
        reviewer_employee_id: 5,
        reviewer_type: "subordinate",
      }),
    )

    await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: true,
        include_subordinates: true,
        peer_count: 0,
      },
    })
    const afterRetry = await db
      .prepare("SELECT COUNT(*) AS total FROM review_forms")
      .first<{ total: number }>()
    expect(afterRetry?.total).toBe(9)
  })

  test("uses effective-dated lifecycle assignments after migration is verified", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (1, 'Product');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 1, NULL, NULL, 1);
      INSERT INTO employees (id, code, name, status) VALUES
        (2, 'E002', 'Current Manager', 'retired'),
        (5, 'E005', 'Member A', 'active'),
        (6, 'E006', 'Member B', 'active'),
        (9, 'E009', 'Future Employee', 'active');
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code) VALUES
        ('D001', 'E005', 'E009'), ('D001', 'E006', 'E009');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-5', 1, 5, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-6', 1, 6, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-9', 1, 9, '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-5', 1, 'employment-5', 5, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-6', 1, 'employment-6', 6, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-9', 1, 'employment-9', 9, 'active', '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-2', 1, 'employment-2', 2, 'D001', 'primary', 'Manager', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-5', 1, 'employment-5', 5, 'D001', 'primary', 'Member', 2, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-6', 1, 'employment-6', 6, 'D001', 'primary', 'Member', 2, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-9', 1, 'employment-9', 9, 'D001', 'primary', 'Member', NULL, '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO review_cycles
        (id, title, period, status, due_date) VALUES (1, 'Review', '2026-H1', 'draft', NULL);
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
      WHERE id = 1;
    `)

    const generated = await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: false,
        include_subordinates: false,
        peer_count: 0,
      },
    })

    expect(generated).toBe(5)
    const rows = await db.prepare("SELECT * FROM review_forms ORDER BY id").all()
    expect(rows.results).toContainEqual(
      expect.objectContaining({
        subject_employee_id: 5,
        reviewer_employee_id: 2,
        reviewer_type: "manager",
      }),
    )
    expect(rows.results.some((row) => row.subject_employee_id === 9)).toBe(false)
    expect(rows.results.some((row) => row.reviewer_employee_id === 9)).toBe(false)
  })
})
