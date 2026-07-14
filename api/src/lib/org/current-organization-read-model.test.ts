import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("loadCurrentOrganization", () => {
  test("derives members, reporting managers, and department responsibility from lifecycle facts", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO departments (id, name) VALUES (1, 'Product'), (2, 'Sales');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order) VALUES
        ('D001', 1, NULL, 'E009', 1), ('D002', 2, NULL, NULL, 2);
      INSERT INTO employees (id, code, name, status, position) VALUES
        (1, 'E001', 'Owner', 'retired', 'Legacy'),
        (2, 'E002', 'Manager', 'retired', 'Legacy'),
        (5, 'E005', 'Member', 'active', 'Legacy'),
        (9, 'E009', 'Legacy Manager', 'active', 'Legacy');
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code)
      VALUES ('D002', 'E005', 'E009');
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
        ('assignment-5', 1, 'employment-5', 5, 'D001', 'primary', 'Engineer', 2, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-5c', 1, 'employment-5', 5, 'D002', 'concurrent', 'Advisor', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-9', 1, 'employment-9', 9, 'D002', 'primary', 'Legacy', NULL, '2027-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO org_responsibility_period_versions
        (period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('responsibility-1', 1, 'D001', 'department_manager', 1,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)

    const organization = await loadCurrentOrganization(context)

    expect(organization).not.toBeInstanceOf(Error)
    const model = organization as Exclude<typeof organization, Error>
    expect(model.source).toBe("lifecycle")
    expect(model.managerByDepartmentCode.get("D001")).toBe("E001")
    expect(model.employeesByCode.get("E005")).toEqual(
      expect.objectContaining({
        position: "Engineer",
        primaryDepartmentCode: "D001",
        managerEmployeeCode: "E002",
        departmentCodes: ["D001", "D002"],
      }),
    )
    expect(model.employeesByCode.has("E009")).toBe(false)
  })
})
