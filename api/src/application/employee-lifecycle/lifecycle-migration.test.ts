import { BackfillLifecycleMigration } from "@/application/employee-lifecycle/backfill-lifecycle-migration"
import { PreflightLifecycleMigration } from "@/application/employee-lifecycle/preflight-lifecycle-migration"
import { RebuildLifecycleProjections } from "@/application/employee-lifecycle/rebuild-lifecycle-projections"
import { VerifyLifecycleMigration } from "@/application/employee-lifecycle/verify-lifecycle-migration"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function legacyFixture(): Promise<{ context: Context; db: D1Database }> {
  const setup = createTestContext()
  setup.context.env.NOW = "2026-06-01T00:00:00.000Z"
  await setup.db.exec(`
    INSERT INTO departments (id, name) VALUES (1, 'Product'), (2, 'Sales');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES
      ('D001', 1, NULL, 'E001', 1),
      ('D002', 2, NULL, NULL, 2);
    INSERT INTO employees (id, code, name, dept_id, dept_name, position, status) VALUES
      (1, 'E001', 'Fixture One', 1, 'Product', 'Manager', 'active'),
      (2, 'E002', 'Fixture Two', 1, 'Product', 'Member', 'leave'),
      (3, 'E003', 'Fixture Three', NULL, NULL, NULL, 'retired');
    INSERT INTO org_memberships
      (department_code, employee_code, manager_employee_code) VALUES
      ('D001', 'E002', 'E001'),
      ('D002', 'E002', NULL);
  `)
  return setup
}

const migrationInput = { baselineOn: "2026-01-01", timeZone: "Asia/Tokyo" }

function expectCode(result: unknown, code: string): void {
  expect(result).toBeInstanceOf(ApplicationError)
  expect((result as ApplicationError).code).toBe(code)
}

describe("employee lifecycle migration", () => {
  test("preflight returns a stable fingerprint and rejects ambiguous or broken legacy relations", async () => {
    const { context, db } = await legacyFixture()
    const first = await new PreflightLifecycleMigration(context).run(migrationInput)
    const second = await new PreflightLifecycleMigration(context).run(migrationInput)

    expect(first).not.toBeInstanceOf(ApplicationError)
    expect(first).toEqual(second)
    expect(first).toEqual(
      expect.objectContaining({
        baselineOn: "2026-01-01",
        timeZone: "Asia/Tokyo",
        employeeCount: 3,
        departmentCount: 2,
        legacySourceFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        issues: [],
      }),
    )

    await db.exec(`
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001-DUP', 1, NULL, NULL, 3);
      UPDATE org_memberships SET manager_employee_code = 'UNKNOWN'
      WHERE employee_code = 'E002' AND department_code = 'D001';
    `)
    const broken = await new PreflightLifecycleMigration(context).run(migrationInput)
    expect(broken).not.toBeInstanceOf(ApplicationError)
    expect(
      (broken as Exclude<typeof broken, ApplicationError>).issues.map((issue) => issue.code),
    ).toEqual(["ambiguous_department_mapping", "broken_manager_reference"])
  })

  test("backfills deterministic baselines, is restart-safe, and verifies only complete data", async () => {
    const { context, db } = await legacyFixture()
    const preflight = await new PreflightLifecycleMigration(context).run(migrationInput)
    expect(preflight).not.toBeInstanceOf(ApplicationError)
    const fingerprint = (preflight as Exclude<typeof preflight, ApplicationError>)
      .legacySourceFingerprint
    const command = { ...migrationInput, legacySourceFingerprint: fingerprint }

    const first = await new BackfillLifecycleMigration(context).run(command)
    const second = await new BackfillLifecycleMigration(context).run(command)
    expect(first).not.toBeInstanceOf(ApplicationError)
    expect(second).not.toBeInstanceOf(ApplicationError)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'legacy_baseline'")
        .first<number>("count"),
    ).toBe(3)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM employment_period_versions")
        .first<number>("count"),
    ).toBe(2)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM org_assignment_period_versions")
        .first<number>("count"),
    ).toBe(3)
    expect(
      await db
        .prepare("SELECT status FROM lifecycle_migration_state WHERE id = 1")
        .first<string>("status"),
    ).toBe("backfilled")

    const verified = await new VerifyLifecycleMigration(context).run(command)
    expect(verified).not.toBeInstanceOf(ApplicationError)
    expect(
      await db
        .prepare("SELECT status FROM lifecycle_migration_state WHERE id = 1")
        .first<string>("status"),
    ).toBe("verified")
  })

  test("rejects backfill when legacy data changed after preflight", async () => {
    const { context, db } = await legacyFixture()
    const preflight = await new PreflightLifecycleMigration(context).run(migrationInput)
    expect(preflight).not.toBeInstanceOf(ApplicationError)
    const fingerprint = (preflight as Exclude<typeof preflight, ApplicationError>)
      .legacySourceFingerprint

    await db.prepare("UPDATE employees SET position = 'Changed' WHERE id = 1").run()
    const result = await new BackfillLifecycleMigration(context).run({
      ...migrationInput,
      legacySourceFingerprint: fingerprint,
    })

    expectCode(result, "personnel_action_stale")
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'legacy_baseline'")
        .first<number>("count"),
    ).toBe(0)
  })

  test("does not mark a projection mismatch as verified", async () => {
    const { context, db } = await legacyFixture()
    const preflight = await new PreflightLifecycleMigration(context).run(migrationInput)
    const fingerprint = (preflight as Exclude<typeof preflight, ApplicationError>)
      .legacySourceFingerprint
    const command = { ...migrationInput, legacySourceFingerprint: fingerprint }
    await new BackfillLifecycleMigration(context).run(command)
    await db.prepare("UPDATE employees SET dept_name = 'Mismatch' WHERE id = 1").run()

    const result = await new VerifyLifecycleMigration(context).run(command)

    expectCode(result, "lifecycle_projection_mismatch")
    expect(
      await db
        .prepare("SELECT status FROM lifecycle_migration_state WHERE id = 1")
        .first<string>("status"),
    ).toBe("backfilled")
  })

  test("rebuilds compatibility projections from a verified schedule at one company date", async () => {
    const { context, db } = await legacyFixture()
    const preflight = await new PreflightLifecycleMigration(context).run(migrationInput)
    const fingerprint = (preflight as Exclude<typeof preflight, ApplicationError>)
      .legacySourceFingerprint
    const command = { ...migrationInput, legacySourceFingerprint: fingerprint }
    await new BackfillLifecycleMigration(context).run(command)
    await new VerifyLifecycleMigration(context).run(command)
    await db.exec(`
      UPDATE employees SET dept_id = NULL, dept_name = NULL, position = NULL, status = 'retired'
      WHERE id = 2;
      DELETE FROM org_memberships WHERE employee_code = 'E002';
    `)

    const result = await new RebuildLifecycleProjections(context).run()

    expect(result).toEqual({
      businessDate: "2026-06-01",
      employeesChanged: 1,
      membershipsChanged: 3,
    })
    expect(
      await db.prepare("SELECT dept_name FROM employees WHERE id = 2").first<string>("dept_name"),
    ).toBe("Product")
    expect(
      await db.prepare("SELECT status FROM employees WHERE id = 2").first<string>("status"),
    ).toBe("leave")
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM org_memberships WHERE employee_code = 'E002'")
        .first<number>("count"),
    ).toBe(2)
  })
})
