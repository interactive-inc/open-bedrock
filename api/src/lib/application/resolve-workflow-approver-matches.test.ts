import { resolveWorkflowApproverMatches } from "@/lib/application/resolve-workflow-approver-matches"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

describe("resolveWorkflowApproverMatches", () => {
  test("resolves effective-dated managers and responsibilities after lifecycle verification", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (1, 'Product');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 1, NULL, 'E009', 1);
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Department Owner', 'retired'),
        (2, 'E002', 'Direct Manager', 'retired'),
        (5, 'E005', 'Applicant', 'active'),
        (9, 'E009', 'Legacy Manager', 'active');
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code)
      VALUES ('D001', 'E005', 'E009');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      SELECT 'employment-' || id, 1, id, '2025-01-01', NULL, 0, 'fixture', 1
        FROM employees;
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      SELECT 'status-' || id, 1, 'employment-' || id, id, 'active', '2025-01-01',
             NULL, 0, 'fixture', 1 FROM employees;
      INSERT INTO org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Director', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-2', 1, 'employment-2', 2, 'D001', 'primary', 'Manager', 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-5', 1, 'employment-5', 5, 'D001', 'primary', 'Member', 2, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-9', 1, 'employment-9', 9, 'D001', 'primary', 'Legacy', NULL, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO org_responsibility_period_versions
        (period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('responsibility-1', 1, 'D001', 'department_manager', 1,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)

    const matches = await resolveWorkflowApproverMatches({
      c: context,
      applicantEmployeeId: 5,
      selectors: [
        { type: "direct_manager" },
        { type: "department_manager" },
        { type: "management_chain" },
        { type: "target_department_manager" },
      ],
      targetDepartmentCode: "D001",
    })

    expect(matches).not.toBeInstanceOf(Error)
    expect(
      (matches as Exclude<typeof matches, Error>).map((match) => [
        match.provenance.selector_index,
        match.employeeId,
      ]),
    ).toEqual([
      [0, 2],
      [1, 1],
      [2, 2],
      [2, 1],
      [3, 1],
    ])
    expect(JSON.stringify(matches)).not.toContain("E009")
  })
})
