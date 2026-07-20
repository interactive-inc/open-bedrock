import {
  listLifecycleManagedEmployeeIds,
  resolveLifecycleOrganizationAuthority,
} from "@/lib/org/lifecycle-organization-authority"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function organizationFixture() {
  const setup = createTestContext()
  await setup.db.exec(`
    INSERT INTO departments (id, name) VALUES (1, 'Product'), (2, 'Sales');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES ('D001', 1, NULL, NULL, 1), ('D002', 2, NULL, NULL, 2);
    INSERT INTO employees (id, code, name, status) VALUES
      (1, 'E001', 'Fixture One', 'active'),
      (2, 'E002', 'Fixture Two', 'active'),
      (3, 'E003', 'Fixture Three', 'active'),
      (4, 'E004', 'Fixture Four', 'active');
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
    SELECT 'employment-' || id, 1, id, '2026-01-01', NULL, 0, 'fixture', 1 FROM employees;
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at)
    SELECT 'status-' || id, 1, 'employment-' || id, id, 'active', '2026-01-01',
           NULL, 0, 'fixture', 1 FROM employees;
    INSERT INTO org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at) VALUES
      ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Director', NULL, '2026-01-01', NULL, 0, 'fixture', 1),
      ('assignment-2-old', 1, 'employment-2', 2, 'D001', 'primary', 'Manager', 1, '2026-01-01', '2027-01-01', 0, 'fixture', 1),
      ('assignment-2-new', 1, 'employment-2', 2, 'D002', 'primary', 'Manager', 4, '2027-01-01', NULL, 0, 'fixture', 1),
      ('assignment-3', 1, 'employment-3', 3, 'D001', 'primary', 'Member', 2, '2026-01-01', NULL, 0, 'fixture', 1),
      ('assignment-4', 1, 'employment-4', 4, 'D002', 'primary', 'Director', NULL, '2026-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO org_responsibility_period_versions
      (period_id, revision, department_code, responsibility_type, employee_id,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES ('responsibility-1', 1, 'D001', 'department_manager', 1,
            '2026-01-01', '2027-01-01', 0, 'fixture', 1);
    UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
  `)
  return setup
}

describe("lifecycle organization authority", () => {
  test("resolves direct manager, management chain, and department responsibility", async () => {
    const { context } = await organizationFixture()
    expect(await resolveLifecycleOrganizationAuthority(context, 1, 2, "2026-06-01")).toEqual({
      directManager: true,
      departmentManager: true,
      managementChain: true,
    })
    expect(await resolveLifecycleOrganizationAuthority(context, 1, 3, "2026-06-01")).toEqual({
      directManager: false,
      departmentManager: true,
      managementChain: true,
    })
    expect(await listLifecycleManagedEmployeeIds(context, 1, "2026-06-01")).toEqual([2, 3])
  })

  test("uses the requested boundary and rejects authority from expired relations", async () => {
    const { context } = await organizationFixture()
    expect(await resolveLifecycleOrganizationAuthority(context, 1, 2, "2027-01-01")).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })
    expect(await resolveLifecycleOrganizationAuthority(context, 4, 2, "2027-01-01")).toEqual({
      directManager: true,
      departmentManager: false,
      managementChain: true,
    })
  })

  test("fails closed for a corrupt cycle and excludes archived departments", async () => {
    const { context, db } = await organizationFixture()
    await db.exec(`
      INSERT INTO org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('cycle-1', 1, 'employment-1', 1, 'D001', 'concurrent', NULL, 3,
              '2026-01-01', NULL, 0, 'fixture', 1);
    `)
    const cyclic = await resolveLifecycleOrganizationAuthority(context, 1, 3, "2026-06-01")
    expect(cyclic).toBeInstanceOf(ApplicationError)
    expect((cyclic as ApplicationError).code).toBe("manager_cycle")

    await db.prepare("UPDATE org_departments SET archived_at = 1 WHERE code = 'D001'").run()
    const archived = await resolveLifecycleOrganizationAuthority(context, 1, 2, "2026-06-01")
    expect(archived).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })
  })
})
