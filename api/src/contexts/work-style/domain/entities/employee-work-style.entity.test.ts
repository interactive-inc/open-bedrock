import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { EmployeeWorkStyle } from "@/contexts/work-style/domain/entities/employee-work-style.entity"
import { describe, expect, test } from "bun:test"

describe("EmployeeWorkStyle.create", () => {
  test("builds an unsaved record with null id", () => {
    const workStyle = EmployeeWorkStyle.create({
      employeeId: toWorkforceEmployeeId(1),
      style: "flextime",
      startsOn: "2026-04-01",
      endsOn: null,
      note: "本社勤務",
      createdAt: "2026-04-01T00:00:00.000Z",
    })

    expect(workStyle).toBeInstanceOf(EmployeeWorkStyle)
    expect(workStyle.id).toBe(null)
    expect(workStyle.employeeId).toBe(toWorkforceEmployeeId(1))
    expect(workStyle.style).toBe("flextime")
    expect(workStyle.startsOn).toBe("2026-04-01")
    expect(workStyle.endsOn).toBe(null)
  })

  test("rejects an unknown style", () => {
    expect(() =>
      EmployeeWorkStyle.create({
        employeeId: toWorkforceEmployeeId(1),
        // @ts-expect-error 不正な style を弾くことを確認する
        style: "remote",
        startsOn: "2026-04-01",
        endsOn: null,
        note: null,
        createdAt: "2026-04-01T00:00:00.000Z",
      }),
    ).toThrow()
  })
})
