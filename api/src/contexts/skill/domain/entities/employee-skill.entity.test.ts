import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import { describe, expect, test } from "bun:test"

describe("EmployeeSkill.create", () => {
  test("builds with given fields", () => {
    const skill = EmployeeSkill.create({
      employeeId: toWorkforceEmployeeId(3),
      skillCode: "TS",
      level: 7,
      years: 5,
      note: "Primary language",
    })

    expect(skill).toBeInstanceOf(EmployeeSkill)
    expect(skill.employeeId).toBe(toWorkforceEmployeeId(3))
    expect(skill.skillCode).toBe("TS")
    expect(skill.level).toBe(7)
    expect(skill.years).toBe(5)
    expect(skill.note).toBe("Primary language")
  })

  test("accepts null years and note", () => {
    const skill = EmployeeSkill.create({
      employeeId: toWorkforceEmployeeId(4),
      skillCode: "GO",
      level: 3,
      years: null,
      note: null,
    })

    expect(skill.years).toBeNull()
    expect(skill.note).toBeNull()
  })
})

describe("EmployeeSkill validation", () => {
  test("rejects level below 1", () => {
    expect(() =>
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TS",
        level: 0,
        years: null,
        note: null,
      }),
    ).toThrow()
  })

  test("rejects level above 10", () => {
    expect(() =>
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TS",
        level: 11,
        years: null,
        note: null,
      }),
    ).toThrow()
  })

  test("rejects negative years", () => {
    expect(() =>
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TS",
        level: 5,
        years: -1,
        note: null,
      }),
    ).toThrow()
  })

  test("rejects non-integer years", () => {
    expect(() =>
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TS",
        level: 5,
        years: 2.5,
        note: null,
      }),
    ).toThrow()
  })
})
