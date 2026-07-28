import { Session } from "@/lib/auth/session"
import { ApplyPersonnelAction } from "@/application/employee-lifecycle/apply-personnel-action"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

const session = new Session({
  accountId: 1,
  employeeId: 1,
  employeeStatus: "active",
  permissions: new Set(["employee:lifecycle:apply"]),
  roleKeys: ["hr"],
})

async function setupActiveEmployee(): Promise<{ context: Context; db: D1Database }> {
  const setup = createTestContext()
  setup.context.env.NOW = "2026-06-01T00:00:00.000Z"
  await setup.db.exec(`
    INSERT INTO departments (id, name) VALUES (1, 'Product'), (2, 'Sales');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES
      ('D001', 1, NULL, NULL, 1),
      ('D002', 2, NULL, NULL, 2);
    INSERT INTO employees (id, code, name, dept_id, dept_name, position, status)
    VALUES (1, 'E001', 'Fixture User', 1, 'Product', 'Member', 'active');
    INSERT INTO personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json)
    VALUES ('baseline-action', 1, 'legacy_baseline', '2026-01-01', 1, NULL,
            NULL, 'migration', NULL, NULL, 'baseline-operation',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{}');
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
    VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'baseline-action', 1);
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES ('status-1', 1, 'employment-1', 1, 'active', '2026-01-01',
            NULL, 0, 'baseline-action', 1);
    INSERT INTO org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at)
    VALUES ('assignment-1', 1, 'employment-1', 1, 'D001', 'primary', 'Member',
            NULL, '2026-01-01', NULL, 0, 'baseline-action', 1);
    INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
    VALUES (1, 0, 1);
    UPDATE lifecycle_migration_state
    SET status = 'verified', baseline_on = '2026-01-01', company_time_zone = 'Asia/Tokyo',
        legacy_source_fingerprint = 'fixture', employee_count = 1, department_count = 2,
        backfilled_at = 1, verified_at = 1
    WHERE id = 1;
  `)
  return setup
}

const leaveCommand = {
  session,
  employeeId: 1,
  input: { kind: "leave_started" as const, employeeCode: "E001", eventOn: "2026-06-01" },
  idempotencyKey: "leave-operation-1",
  expectedEmployeeRevision: 0,
  expectedOrganizationRevision: null,
}

function expectCode(result: unknown, code: string): void {
  expect(result).toBeInstanceOf(ApplicationError)
  expect((result as ApplicationError).code).toBe(code)
}

describe("ApplyPersonnelAction", () => {
  test("atomically appends a direct action, versions, projection, audit, and revision", async () => {
    const { context, db } = await setupActiveEmployee()

    const result = await new ApplyPersonnelAction(context).run(leaveCommand)

    expect(result).not.toBeInstanceOf(ApplicationError)
    expect(result).toEqual({
      action: expect.objectContaining({ kind: "leave_started", employeeId: 1 }),
      replayed: false,
    })
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'leave_started'")
        .first<number>("count"),
    ).toBe(1)
    expect(
      await db
        .prepare("SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = 1")
        .first<number>("revision"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT status FROM employees WHERE id = 1").first<string>("status"),
    ).toBe("leave")
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'employee.lifecycle.applied'",
        )
        .first<number>("count"),
    ).toBe(1)
  })

  test("returns the existing action for an identical retry and rejects payload reuse", async () => {
    const { context, db } = await setupActiveEmployee()
    const usecase = new ApplyPersonnelAction(context)
    const first = await usecase.run(leaveCommand)
    const replay = await usecase.run(leaveCommand)
    const conflict = await usecase.run({
      ...leaveCommand,
      input: { kind: "leave_started", employeeCode: "E001", eventOn: "2026-06-02" },
    })

    expect(first).not.toBeInstanceOf(ApplicationError)
    expect(replay).toEqual({
      action: (first as Exclude<typeof first, ApplicationError>).action,
      replayed: true,
    })
    expectCode(conflict, "idempotency_conflict")
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM personnel_actions WHERE operation_id = 'leave-operation-1'",
        )
        .first<number>("count"),
    ).toBe(1)
  })

  test("rolls back the whole batch on a stale employee revision", async () => {
    const { context, db } = await setupActiveEmployee()
    await db
      .prepare("UPDATE employee_lifecycle_revisions SET revision = 1 WHERE employee_id = 1")
      .run()

    const result = await new ApplyPersonnelAction(context).run(leaveCommand)

    expectCode(result, "personnel_action_stale")
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'leave_started'")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT status FROM employees WHERE id = 1").first<string>("status"),
    ).toBe("active")
  })

  test("rolls back action and period facts when the mandatory audit append fails", async () => {
    const { context, db } = await setupActiveEmployee()
    await db.exec(`
      CREATE TRIGGER reject_lifecycle_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.action = 'employee.lifecycle.applied'
      BEGIN
        SELECT RAISE(ABORT, 'fixture audit failure');
      END;
    `)

    const result = await new ApplyPersonnelAction(context).run(leaveCommand)

    expect(result).toBeInstanceOf(ApplicationError)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'leave_started'")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await db
        .prepare("SELECT revision FROM employee_lifecycle_revisions WHERE employee_id = 1")
        .first<number>("revision"),
    ).toBe(0)
  })

  test("requires the organization revision for organization-affecting actions", async () => {
    const { context, db } = await setupActiveEmployee()
    const command = {
      ...leaveCommand,
      input: {
        kind: "transferred" as const,
        employeeCode: "E001",
        eventOn: "2026-06-01",
        departmentCode: "D002",
        positionTitle: "Lead",
        managerEmployeeCode: null,
      },
      idempotencyKey: "transfer-operation-1",
    }

    expectCode(await new ApplyPersonnelAction(context).run(command), "personnel_action_stale")
    const applied = await new ApplyPersonnelAction(context).run({
      ...command,
      expectedOrganizationRevision: 0,
    })

    expect(applied).not.toBeInstanceOf(ApplicationError)
    expect(
      await db
        .prepare("SELECT revision FROM organization_lifecycle_state WHERE id = 1")
        .first<number>("revision"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT dept_name FROM employees WHERE id = 1").first<string>("dept_name"),
    ).toBe("Sales")
  })

  test("applies a correction from the original action mutations without exposing its reason", async () => {
    const { context, db } = await setupActiveEmployee()
    const usecase = new ApplyPersonnelAction(context)
    const original = await usecase.run(leaveCommand)
    expect(original).not.toBeInstanceOf(ApplicationError)
    const originalId = (original as Exclude<typeof original, ApplicationError>).action.id

    const corrected = await usecase.run({
      ...leaveCommand,
      idempotencyKey: "correction-operation-1",
      expectedEmployeeRevision: 1,
      input: {
        kind: "corrected",
        eventOn: "2026-06-02",
        correctsActionId: originalId,
        reason: "Fixture private reason",
        replacementAction: {
          kind: "leave_started",
          employeeCode: "E001",
          eventOn: "2026-06-03",
        },
      },
    })

    expect(corrected).not.toBeInstanceOf(ApplicationError)
    const auditAfter = await db
      .prepare("SELECT after_json FROM audit_logs WHERE action = 'employee.lifecycle.corrected'")
      .first<string>("after_json")
    expect(auditAfter).not.toContain("Fixture private reason")
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE corrects_action_id = ?1")
        .bind(originalId)
        .first<number>("count"),
    ).toBe(1)
  })

  test("requires the dedicated apply permission and a verified migration", async () => {
    const { context, db } = await setupActiveEmployee()
    const denied = await new ApplyPersonnelAction(context).run({
      ...leaveCommand,
      session: new Session({
        accountId: 1,
        employeeId: 1,
        employeeStatus: "active",
        permissions: new Set(["employee:update"]),
        roleKeys: ["hr"],
      }),
    })
    expectCode(denied, "forbidden")

    await db.prepare("UPDATE lifecycle_migration_state SET status = 'pending' WHERE id = 1").run()
    const pending = await new ApplyPersonnelAction(context).run(leaveCommand)
    expectCode(pending, "lifecycle_migration_incomplete")
  })
})
