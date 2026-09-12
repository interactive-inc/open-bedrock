import { expect, test } from "bun:test"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { EmployeeEventEntity } from "@/contexts/company/domain/entities/employee-event.entity"

test.each([null, "", "  当時の記録\n  "])("旧注記の文字列を整形・推測せず復元する: %j", (note) => {
  const source = {
    id: 1,
    employeeId: restoreWorkforceId("employee", "employee:source"),
    kind: "legacy-kind",
    effectiveDate: "日付不明",
    fromDepartmentCode: " OLD ",
    toDepartmentCode: "",
    note,
    createdAt: "original timestamp",
  }
  expect(EmployeeEventEntity.restore(source).toProps()).toEqual(source)
})
