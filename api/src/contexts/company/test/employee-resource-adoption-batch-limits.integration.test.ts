import { expect, spyOn, test } from "bun:test"
import { z } from "zod"
import { createEmployeeAdoptionBatchFixture } from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"

test("大きい確認履歴を複数SQLへ分けても最後の証跡失敗で全件取り消し、DBの文字列・bind上限内で再試行する", async () => {
  const context = await createEmployeeAdoptionBatchFixture(10, 95)
  const input = await context.input()
  const before = await context.state()
  await context.database
    .exec(`CREATE TRIGGER fail_last_payload BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = 'employee:batch-9' BEGIN SELECT RAISE(ABORT, 'last payload failed'); END`)
  const intercepted = spyOn(context.database, "batch")
  try {
    expect((await context.post(input)).status).toBe(503)
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(intercepted.mock.calls[0]![0].length).toBeGreaterThan(6)
  } finally {
    intercepted.mockRestore()
  }
  expect(await context.state()).toEqual(before)
  await context.database.exec("DROP TRIGGER fail_last_payload")
  const prepare = context.database.prepare.bind(context.database)
  const bindings: Array<ReadonlyArray<unknown>> = []
  const statements = spyOn(context.database, "prepare").mockImplementation((sql) => {
    expect(new TextEncoder().encode(sql).length).toBeLessThanOrEqual(100_000)
    const statement = prepare(sql)
    const bind = statement.bind.bind(statement)
    spyOn(statement, "bind").mockImplementation((...values) => {
      bindings.push(values)
      return bind(...values)
    })
    return statement
  })
  try {
    expect((await context.post(input)).status).toBe(200)
    expect(statements.mock.calls.length).toBeLessThan(40)
    expect(
      bindings.some((values) =>
        values.some(
          (value) =>
            typeof value === "string" && new TextEncoder().encode(value).length > 1_000_000,
        ),
      ),
    ).toBe(true)
    for (const values of bindings) {
      expect(values.length).toBeLessThanOrEqual(100)
      for (const value of values) {
        if (typeof value === "string")
          expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(1_750_000)
      }
    }
  } finally {
    statements.mockRestore()
  }
  expect((await context.state())[3]).toHaveLength(10)
}, 30_000)

test("各snapshotが個別上限内でも合計8MBを超える依頼は保存を始めず拒否する", async () => {
  const context = await createEmployeeAdoptionBatchFixture(20, 95)
  const snapshots = new EmployeeResourceAdoptionSnapshotAdapter(context.database)
  const employees: Array<{ employeeId: string; snapshotDigest: string }> = []
  for (const employee of context.employees) {
    const snapshot = await snapshots.find(employee.employeeId)
    if (snapshot === null || snapshot instanceof Error)
      throw new Error("missing individual snapshot", { cause: snapshot })
    employees.push({ employeeId: employee.employeeId, snapshotDigest: snapshot.props.digest })
  }
  const before = await context.state()
  const intercepted = spyOn(context.database, "batch")
  try {
    const response = await context.post({
      expectedRevision: 97,
      observedOn: "2026-09-07",
      reason: "Confirmed history",
      employees,
    })
    expect(response.status).toBe(422)
    expect(
      z
        .object({ code: z.string() })
        .strict()
        .parse(await response.json()),
    ).toEqual({ code: "employee_resource_adoption_batch_too_large" })
    expect(intercepted).not.toHaveBeenCalled()
  } finally {
    intercepted.mockRestore()
  }
  expect(await context.state()).toEqual(before)
}, 30_000)
