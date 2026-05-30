import { EmployeeSkill } from "@/domain/skill/employee-skill"
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
})
