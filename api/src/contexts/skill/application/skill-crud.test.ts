import { describe, expect, test } from "bun:test"
import { EmployeeSkill } from "@/contexts/skill/domain/employee-skill.entity"
import { SetMySkill } from "@/contexts/skill/application/set-my-skill"
import { ApplicationError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"

async function seedSkillMaster(db: D1Database, code: string): Promise<void> {
  await seedD1(db, "skill_definitions", [
    { code: code, name: `Skill ${code}`, category: "engineering" },
  ])
}

describe("SetMySkill", () => {
  test("registers a new skill for the employee", async () => {
    const { context, db } = createTestContext()

    await seedSkillMaster(db, "typescript")

    const result = await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
      level: 7,
      years: 3,
      note: null,
    })

    if (result instanceof ApplicationError) {
      throw new Error("set failed")
    }

    expect(result.employeeSkill).toBeInstanceOf(EmployeeSkill)
    expect(result.employeeSkill.level).toBe(7)
    expect(result.employeeSkill.years).toBe(3)
    expect(result.skill.code).toBe("typescript")
  })

  test("updates an existing skill registration", async () => {
    const { context, db } = createTestContext()

    await seedSkillMaster(db, "typescript")

    await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
      level: 5,
      years: 2,
      note: null,
    })

    const result = await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
      level: 8,
      years: 4,
      note: "advanced",
    })

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.employeeSkill.level).toBe(8)
    expect(result.employeeSkill.years).toBe(4)
    expect(result.employeeSkill.note).toBe("advanced")
  })

  test("rejects unknown skill code with skill_not_found", async () => {
    const { context } = createTestContext()

    const result = await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "nonexistent",
      level: 5,
      years: null,
      note: null,
    })

    expectApplicationError(result, NotFoundError, "skill_not_found")
  })
})

describe("GetMySkill", () => {})

describe("RemoveMySkill", () => {})
