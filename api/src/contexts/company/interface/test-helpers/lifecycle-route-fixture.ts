import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments"
import { seedPositions } from "@/contexts/company/infrastructure/seed/seed-positions"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"

export const lifecycleRouteJwtSecret = "lifecycle-route-test-secret"

export async function createLifecycleRouteDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
  )
  await seedD1(
    db,
    "org_departments",
    seedOrgDepartments.map((department) => ({
      code: department.code,
      department_id: department.departmentId,
      parent_code: department.parentCode,
      manager_employee_code: department.managerEmployeeCode,
      sort_order: department.order,
    })),
  )
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )
  await seedD1(
    db,
    "position_definitions",
    seedPositions.map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
    })),
  )
  await seedIamForEmployees(db)
  await db.exec(`
    INSERT INTO personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json)
    VALUES ('00000000-0000-4000-8000-000000000005', 5, 'legacy_baseline', '2025-01-01', 1,
            NULL, NULL, 'migration', NULL, NULL, 'fixture-baseline',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '{"kind":"legacy_baseline","eventOn":"2025-01-01","department":{"code":"D003","name":"Engineering"},"positionTitle":"Engineer","managerEmployeeCode":"E004","status":"active"}');
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at) VALUES
      ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
      ('employment-4', 1, 4, '2025-01-01', NULL, 0, 'fixture', 1),
      ('employment-5', 1, 5, '2025-01-01', NULL, 0, '00000000-0000-4000-8000-000000000005', 1),
      ('employment-6', 1, 6, '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
      ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
      ('status-4', 1, 'employment-4', 4, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
      ('status-5', 1, 'employment-5', 5, 'active', '2025-01-01', NULL, 0, '00000000-0000-4000-8000-000000000005', 1),
      ('status-6', 1, 'employment-6', 6, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at) VALUES
      ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Director', NULL, '2025-01-01', NULL, 0, 'fixture', 1),
      ('assignment-4', 1, 'employment-4', 4, 'D003', 'primary', 'Manager', 1, '2025-01-01', NULL, 0, 'fixture', 1),
      ('assignment-5', 1, 'employment-5', 5, 'D003', 'primary', 'Engineer', 4, '2025-01-01', NULL, 0, '00000000-0000-4000-8000-000000000005', 1),
      ('assignment-6', 1, 'employment-6', 6, 'D004', 'primary', 'Sales', NULL, '2025-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_org_responsibility_period_versions
      (period_id, revision, department_code, responsibility_type, employee_id,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES ('responsibility-4', 1, 'D003', 'department_manager', 4,
            '2025-01-01', NULL, 0, 'fixture', 1);
    UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
  `)
  return db
}
