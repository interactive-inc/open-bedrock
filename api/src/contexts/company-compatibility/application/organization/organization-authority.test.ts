import { describe, expect, test } from "bun:test"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { listManagedEmployeeIds } from "@/contexts/company-compatibility/application/organization/list-managed-employee-ids"
import { resolveOrganizationAuthority } from "@/contexts/company-compatibility/application/organization/resolve-organization-authority"

async function setup() {
  const { context, db } = createTestContext()

  await seedD1(db, "departments", [
    { id: 1, name: "Head Office" },
    { id: 2, name: "Team" },
  ])

  await seedD1(db, "employees", [
    { id: 1, code: "E001", name: "Director", status: "active" },
    { id: 2, code: "E002", name: "Manager", status: "active" },
    { id: 3, code: "E003", name: "Member", status: "active" },
    { id: 4, code: "E004", name: "Other", status: "active" },
  ])

  await seedD1(db, "org_departments", [
    { code: "ROOT", department_id: 1, manager_employee_code: "E001", sort_order: 1 },
    {
      code: "TEAM",
      department_id: 2,
      parent_code: "ROOT",
      manager_employee_code: "E002",
      sort_order: 2,
    },
  ])

  await seedD1(db, "org_memberships", [
    { department_code: "ROOT", employee_code: "E001" },
    { department_code: "TEAM", employee_code: "E002", manager_employee_code: "E001" },
    { department_code: "TEAM", employee_code: "E003", manager_employee_code: "E002" },
    { department_code: "ROOT", employee_code: "E004", manager_employee_code: "E001" },
  ])

  await db.exec(`
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at) VALUES
      ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
      ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1),
      ('employment-3', 1, 3, '2025-01-01', NULL, 0, 'fixture', 1),
      ('employment-4', 1, 4, '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
      ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
      ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
      ('status-3', 1, 'employment-3', 3, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
      ('status-4', 1, 'employment-4', 4, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at) VALUES
      ('assignment-1', 1, 'employment-1', 1, 'ROOT', 'primary', NULL, NULL,
       '2025-01-01', NULL, 0, 'fixture', 1),
      ('assignment-2', 1, 'employment-2', 2, 'TEAM', 'primary', NULL, 1,
       '2025-01-01', NULL, 0, 'fixture', 1),
      ('assignment-3', 1, 'employment-3', 3, 'TEAM', 'primary', NULL, 2,
       '2025-01-01', NULL, 0, 'fixture', 1),
      ('assignment-4', 1, 'employment-4', 4, 'ROOT', 'primary', NULL, 1,
       '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_org_responsibility_period_versions
      (period_id, revision, department_code, responsibility_type, employee_id,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
      ('responsibility-1', 1, 'ROOT', 'department_manager', 1,
       '2025-01-01', NULL, 0, 'fixture', 1),
      ('responsibility-2', 1, 'TEAM', 'department_manager', 2,
       '2025-01-01', NULL, 0, 'fixture', 1);
    UPDATE lifecycle_migration_states
    SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
    WHERE id = 1;
  `)

  return context
}

describe("organization authority", () => {
  test("resolves direct, department and ancestor relationships", async () => {
    const context = await setup()

    expect(await resolveOrganizationAuthority(context, 2, 3)).toEqual({
      directManager: true,
      departmentManager: true,
      managementChain: true,
    })

    expect(await resolveOrganizationAuthority(context, 1, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: true,
    })
  })

  test("does not grant authority to unrelated employees or self", async () => {
    const context = await setup()

    expect(await resolveOrganizationAuthority(context, 4, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })

    expect(await resolveOrganizationAuthority(context, 3, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })
  })

  test("lists direct, indirect and department-managed employees", async () => {
    const context = await setup()

    expect(await listManagedEmployeeIds(context, 1)).toEqual([2, 3, 4])
    expect(await listManagedEmployeeIds(context, 2)).toEqual([3])
    expect(await listManagedEmployeeIds(context, 3)).toEqual([])
  })
})
