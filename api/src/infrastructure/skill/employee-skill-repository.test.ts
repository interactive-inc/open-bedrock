import { EmployeeSkill } from "@/domain/skill/employee-skill.entity"
import { EmployeeSkillRepository } from "@/infrastructure/skill/employee-skill-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("EmployeeSkillRepository", () => {
  test("save round-trips the employee skill", async () => {
    const { context } = createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: 1,
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

    expect(saved.employeeId).toBe(1)
    expect(saved.skillCode).toBe("TYPESCRIPT")
    expect(saved.level).toBe(3)
  })

  test("delete returns null for non-existent skill", async () => {
    const { context } = createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const deleted = await repository.delete({ employeeId: 1, skillCode: "UNKNOWN" })

    expect(deleted).toBeNull()
  })

  test("delete returns true for existing skill", async () => {
    const { context } = createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: 1,
        skillCode: "TYPESCRIPT",
        level: 3,
        years: 2,
        note: null,
      }),
    )

    if (saved instanceof Error) {
      throw saved
    }

    const deleted = await repository.delete({ employeeId: 1, skillCode: "TYPESCRIPT" })

    expect(deleted).toBe(true)
  })

  test("delete returns null on second delete of same skill", async () => {
    const { context } = createTestContext()

    const repository = new EmployeeSkillRepository(context)

    const saved = await repository.save(
      EmployeeSkill.create({
        employeeId: 1,
        skillCode: "TYPESCRIPT",
        level: 3,
        years: 2,
        note: null,
      }),
    )

    if (saved instanceof Error) {
      throw saved
    }

    const first = await repository.delete({ employeeId: 1, skillCode: "TYPESCRIPT" })

    expect(first).toBe(true)

    const second = await repository.delete({ employeeId: 1, skillCode: "TYPESCRIPT" })

    expect(second).toBeNull()
  })
})
