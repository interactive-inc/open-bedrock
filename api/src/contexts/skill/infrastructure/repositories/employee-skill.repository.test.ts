import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/repositories/employee-skill.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("EmployeeSkillRepository", () => {
  test("save round-trips the employee skill", async () => {
    const { context } = await createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TYPESCRIPT",
        level: 3,
        years: 2,
        note: null,
      }),
    )

    expect(saved).toBeInstanceOf(EmployeeSkill)

    if (saved instanceof Error) {
      throw saved
    }

    expect(saved.employeeId).toBe(toWorkforceEmployeeId(1))
    expect(saved.skillCode).toBe("TYPESCRIPT")
    expect(saved.level).toBe(3)
  })

  test("delete returns null for non-existent skill", async () => {
    const { context } = await createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const deleted = await repository.delete({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "UNKNOWN",
    })

    expect(deleted).toBeNull()
  })

  test("delete returns true for existing skill", async () => {
    const { context } = await createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TYPESCRIPT",
        level: 3,
        years: 2,
        note: null,
      }),
    )

    if (saved instanceof Error) {
      throw saved
    }

    const deleted = await repository.delete({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "TYPESCRIPT",
    })

    expect(deleted).toBe(true)
  })

  test("delete returns null on second delete of same skill", async () => {
    const { context } = await createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "TYPESCRIPT",
        level: 3,
        years: 2,
        note: null,
      }),
    )

    if (saved instanceof Error) {
      throw saved
    }

    const first = await repository.delete({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "TYPESCRIPT",
    })

    expect(first).toBe(true)

    const second = await repository.delete({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "TYPESCRIPT",
    })

    expect(second).toBeNull()
  })
})
