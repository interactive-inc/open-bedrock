import { resolveOrganizationalAuthorityCandidates } from "@/contexts/company/infrastructure/organization/resolve-organizational-authority-candidates.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import type { OrganizationChangeSet } from "@/contexts/company/domain/workforce/organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { OrganizationChangeRepository } from "@/contexts/company/infrastructure/workforce/organization-change.repository"
import { ConflictError, UnavailableError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/values/account-id.schema"

describe("resolveOrganizationalAuthorityCandidates", () => {
  test("rejects an unverified migration instead of reading the legacy projection", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status, archived_at) VALUES
        (1, 'E001', 'Manager', 'active', NULL),
        (2, 'E002', 'Subject', 'active', NULL),
        (3, 'E003', 'Archived', 'active', 1),
        (4, 'E004', 'Retired', 'retired', NULL);
      INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0),
        (12, 'active', 0, 0),
        (13, 'active', 0, 0),
        (14, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES
        (11, 1), (12, 2), (13, 3), (14, 4);
      INSERT INTO system_iam_roles
        (id, key, kind, name, description, created_at, updated_at)
        VALUES ('technical-admin', 'company:technical_admin', 'managed',
                'Technical admin', NULL, 0, 0);
      INSERT INTO system_role_bindings
        (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
        VALUES ('test:11:technical-admin', '11', 'technical-admin', NULL, NULL, 0, NULL);
      INSERT INTO departments (id, name) VALUES (1, 'Product');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 1, NULL, 'E001', 1);
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code) VALUES
        ('D001', 'E002', 'E001'),
        ('D001', 'E003', 'E001'),
        ('D001', 'E004', 'E001');
    `)

    const resolution = await resolveOrganizationalAuthorityCandidates({
      c: context,
      subjectEmployeeId: 2,
      criteria: [
        { kind: "direct_manager" },
        { kind: "employee", employeeCode: "E002" },
        { kind: "employee", employeeCode: "E003" },
        { kind: "employee", employeeCode: "E004" },
        { kind: "legacy_account_role", roleKey: "technical_admin" },
      ],
      resolvedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(resolution).toBeInstanceOf(UnavailableError)
    expect(resolution).toMatchObject({ code: "company_migration_incomplete" })
  })

  test("fails closed when the management graph contains a cycle", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'One', 'active'),
        (2, 'E002', 'Two', 'active');
      INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0), (12, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES (11, 1), (12, 2);
      INSERT INTO departments (id, name) VALUES (1, 'Product');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 1, NULL, 'E001', 1);
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code) VALUES
        ('D001', 'E001', 'E002'),
        ('D001', 'E002', 'E001');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', NULL, 2,
         '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-2', 1, 'employment-2', 2, 'D001', 'primary', NULL, 1,
         '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
      WHERE id = 1;
    `)

    const resolution = await resolveOrganizationalAuthorityCandidates({
      c: context,
      subjectEmployeeId: 1,
      criteria: [{ kind: "management_chain" }],
      resolvedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(resolution).toBeInstanceOf(ConflictError)
    expect(resolution).toMatchObject({ code: "manager_cycle" })
  })

  test("resolves authority from a canonical-only opaque organization unit", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Manager', 'active'),
        (2, 'E002', 'Subject', 'active');
      INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0), (12, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES (11, 1), (12, 2);
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
    `)

    const operationId = restoreWorkforceId("personnel_action", "action:canonical-team")
    const organizationUnitId = restoreWorkforceId("organization_unit", "team:platform")
    const managerId = restoreWorkforceId("employee", "employee:1")
    const subjectId = restoreWorkforceId("employee", "employee:2")
    const input: OrganizationChangeSet = {
      operationId,
      expectedRevision: 1,
      asOf: restoreCalendarDate("2026-01-01"),
      recordedAt: 2,
      actorAccountId: "account:11",
      reason: "Create canonical authority fixtures",
      evidenceReferences: [],
      organizationUnits: [{ id: organizationUnitId, createdAt: 2 }],
      unitPeriods: [
        {
          periodId: restoreWorkforceId("period", "team:platform:period"),
          revision: 1,
          organizationUnitId,
          code: "PLATFORM",
          officialName: "Platform Team",
          kind: "TEAM",
          parentOrganizationUnitId: restoreWorkforceId("organization_unit", "company:root"),
          startsOn: restoreCalendarDate("2025-01-01"),
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt: 2,
        },
      ],
      assignments: [
        {
          periodId: restoreWorkforceId("period", "assignment:manager"),
          revision: 1,
          employmentId: restoreWorkforceId("employment", "employment:employment-1"),
          employeeId: managerId,
          organizationUnitId,
          assignmentType: "PRIMARY",
          positionTitle: "Manager",
          managerEmployeeId: null,
          startsOn: restoreCalendarDate("2025-01-01"),
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt: 2,
        },
        {
          periodId: restoreWorkforceId("period", "assignment:subject"),
          revision: 1,
          employmentId: restoreWorkforceId("employment", "employment:employment-2"),
          employeeId: subjectId,
          organizationUnitId,
          assignmentType: "PRIMARY",
          positionTitle: null,
          managerEmployeeId: managerId,
          startsOn: restoreCalendarDate("2025-01-01"),
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt: 2,
        },
      ],
      responsibilities: [
        {
          periodId: restoreWorkforceId("period", "responsibility:manager"),
          revision: 1,
          employmentId: restoreWorkforceId("employment", "employment:employment-1"),
          employeeId: managerId,
          organizationUnitId,
          responsibilityType: "MANAGER",
          startsOn: restoreCalendarDate("2025-01-01"),
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt: 2,
        },
        {
          periodId: restoreWorkforceId("period", "responsibility:people-operations"),
          revision: 1,
          employmentId: restoreWorkforceId("employment", "employment:employment-1"),
          employeeId: managerId,
          organizationUnitId,
          responsibilityType: "PEOPLE_OPERATIONS",
          startsOn: restoreCalendarDate("2025-01-01"),
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt: 2,
        },
      ],
    }
    expect(await new OrganizationChangeRepository(context.var.database).append(input)).toEqual({
      ok: true,
      revision: 6,
      replayed: false,
    })
    await db.exec(`
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
      WHERE id = 1
    `)

    const resolution = await resolveOrganizationalAuthorityCandidates({
      c: context,
      subjectEmployeeId: 2,
      criteria: [
        { kind: "direct_manager" },
        { kind: "department_manager" },
        {
          kind: "responsibility",
          responsibilityType: "PEOPLE_OPERATIONS",
          organizationUnitCode: null,
        },
      ],
      resolvedAt: "2026-01-01T00:00:00.000Z",
    })

    if (resolution instanceof Error) throw resolution
    expect(resolution.snapshot).toEqual({
      schemaVersion: 1,
      source: "lifecycle",
      asOf: "2026-01-01",
      organizationRevision: 6,
    })
    expect(resolution.candidates).toHaveLength(3)
    expect(resolution.candidates).toEqual([
      expect.objectContaining({
        employeeId: 1,
        accountId: zAccountId.parse("11"),
        qualification: expect.objectContaining({
          criterionIndex: 0,
          evidence: expect.objectContaining({ type: "lifecycle_assignment" }),
        }),
      }),
      expect.objectContaining({
        employeeId: 1,
        accountId: zAccountId.parse("11"),
        qualification: expect.objectContaining({
          criterionIndex: 1,
          evidence: expect.objectContaining({
            type: "lifecycle_responsibility",
            scope: "subject",
          }),
        }),
      }),
      expect.objectContaining({
        employeeId: 1,
        accountId: zAccountId.parse("11"),
        qualification: expect.objectContaining({
          criterionIndex: 2,
          evidence: expect.objectContaining({
            type: "responsibility",
            responsibility_type: "PEOPLE_OPERATIONS",
          }),
        }),
      }),
    ])
  })

  test("fails closed when the organization revision changes during resolution", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Manager', 'active'),
        (2, 'E002', 'Subject', 'active');
      INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0), (12, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES (11, 1), (12, 2);
      INSERT INTO departments (id, name) VALUES (1, 'Product');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 1, NULL, 'E001', 1);
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at) VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Manager', NULL,
         '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-2', 1, 'employment-2', 2, 'D001', 'primary', 'Member', 1,
         '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01', company_time_zone = 'Asia/Tokyo'
      WHERE id = 1;
      UPDATE organization_lifecycle_states SET revision = 7, updated_at = 1 WHERE id = 1;
    `)

    let revisionReads = 0
    const revisionQuery = "SELECT revision FROM organization_lifecycle_states WHERE id = 1"
    const racingDatabase = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== "prepare") return Reflect.get(target, property, receiver)

        return (query: string) => {
          const statement = target.prepare(query)
          if (query !== revisionQuery) return statement

          return new Proxy(statement, {
            get(statementTarget, statementProperty, statementReceiver) {
              if (statementProperty !== "first") {
                return Reflect.get(statementTarget, statementProperty, statementReceiver)
              }

              return async (columnName?: string) => {
                revisionReads += 1
                if (revisionReads === 2) {
                  await target
                    .prepare(
                      "UPDATE organization_lifecycle_states SET revision = 8, updated_at = 2 WHERE id = 1",
                    )
                    .run()
                }
                return columnName === undefined
                  ? statementTarget.first()
                  : statementTarget.first(columnName)
              }
            },
          })
        }
      },
    })

    const resolution = await resolveOrganizationalAuthorityCandidates({
      c: {
        ...context,
        env: { ...context.env, DB: racingDatabase },
      },
      subjectEmployeeId: 2,
      criteria: [{ kind: "direct_manager" }],
      resolvedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(resolution).toBeInstanceOf(ConflictError)
    expect(resolution).toMatchObject({ code: "organization_revision_conflict" })
  })
})
