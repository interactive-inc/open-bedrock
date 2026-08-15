import { resolveOrganizationalAuthorityCandidates } from "@/contexts/company/application/organization/resolve-organizational-authority-candidates"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { ConflictError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

describe("resolveOrganizationalAuthorityCandidates", () => {
  test("returns only live linked accounts with a fixed legacy snapshot", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status, archived_at) VALUES
        (1, 'E001', 'Manager', 'active', NULL),
        (2, 'E002', 'Subject', 'active', NULL),
        (3, 'E003', 'Archived', 'active', 1),
        (4, 'E004', 'Retired', 'retired', NULL);
      INSERT INTO accounts (id, status, created_at, updated_at) VALUES
        (11, 'active', 0, 0),
        (12, 'active', 0, 0),
        (13, 'active', 0, 0),
        (14, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES
        (11, 1), (12, 2), (13, 3), (14, 4);
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
      ],
      resolvedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(resolution).toEqual({
      snapshot: {
        schemaVersion: 1,
        source: "legacy",
        asOf: "2026-01-01",
        organizationRevision: null,
      },
      candidates: [
        {
          employeeId: 1,
          accountId: 11,
          qualification: {
            criterionIndex: 0,
            evidence: {
              type: "org_membership",
              department_code: "D001",
              employee_code: "E002",
              manager_employee_code: "E001",
            },
          },
        },
      ],
    })
  })

  test("fails closed when the management graph contains a cycle", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'One', 'active'),
        (2, 'E002', 'Two', 'active');
      INSERT INTO accounts (id, status, created_at, updated_at) VALUES
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

  test("fails closed when the organization revision changes during resolution", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Manager', 'active'),
        (2, 'E002', 'Subject', 'active');
      INSERT INTO accounts (id, status, created_at, updated_at) VALUES
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
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at) VALUES
        ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Manager', NULL,
         '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-2', 1, 'employment-2', 2, 'D001', 'primary', 'Member', 1,
         '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
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
