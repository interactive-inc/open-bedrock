import { expect, test } from "bun:test"
import { EmployeeResourceAdoptionBatchEntity } from "@/contexts/company/domain/entities/employee-resource-adoption-batch.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"

const input = {
  commandId: "confirmed-batch",
  expectedRevision: 2,
  observedOn: restoreCalendarDate("2026-09-07"),
  reason: "Confirmed history",
  actorAccountId: "account:example",
  recordedAt: Date.parse("2026-09-07T00:00:00Z"),
  employees: [
    { employeeId: "employee:second", snapshotDigest: "b".repeat(64) },
    { employeeId: "employee:first", snapshotDigest: "a".repeat(64) },
  ],
}

test("呼出元が配列や確認値を変更しても確認対象が変わらず、並び順を固定する", () => {
  const employees = input.employees.map((employee) => ({ ...employee }))
  const command = EmployeeResourceAdoptionBatchEntity.create({ ...input, employees })
  if (command instanceof Error) throw command
  employees[0]!.snapshotDigest = "c".repeat(64)
  employees.length = 0
  expect(command.props.employees).toEqual(input.employees.toReversed())
  expect(Object.isFrozen(command.props.employees)).toBe(true)
  expect(Object.isFrozen(command.props.employees[0])).toBe(true)
})

test("HTTPを通らない呼出しでも重複・不正な確認値・版のoverflow・不正な主体を拒否する", () => {
  for (const change of [
    { employees: [input.employees[0]!, input.employees[0]!] },
    { employees: [] },
    { employees: [{ employeeId: "employee:example", snapshotDigest: "unconfirmed" }] },
    { expectedRevision: Number.MAX_SAFE_INTEGER },
    { expectedRevision: -1 },
    { recordedAt: Number.NaN },
    { actorAccountId: "" },
    { reason: " " },
  ])
    expect(EmployeeResourceAdoptionBatchEntity.create({ ...input, ...change })).toBeInstanceOf(
      CompanyValidationError,
    )
})
