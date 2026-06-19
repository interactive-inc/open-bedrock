import { describe, expect, test } from "bun:test"
import { EmployeeSkill } from "@/domain/skill/employee-skill.entity"
import { SetMySkill } from "@/application/skill/set-my-skill"
import { GetMySkill } from "@/application/skill/get-my-skill"
import { RemoveMySkill } from "@/application/skill/remove-my-skill"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"

async function seedSkillMaster(db: D1Database, code: string): Promise<void> {
  await seedD1(db, "skills", [{ code: code, name: `Skill ${code}`, category: "engineering" }])
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

    if (result instanceof Error || "reason" in result) {
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

    if (result instanceof Error || "reason" in result) {
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

    expect(result).toEqual({ reason: "skill_not_found" })
  })
})

describe("GetMySkill", () => {
  test("returns the registered skill with master data", async () => {
    const { context, db } = createTestContext()

    await seedSkillMaster(db, "typescript")

    await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
      level: 7,
      years: 3,
      note: null,
    })

    const result = await new GetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("get failed")
    }

    expect(result.employeeSkill.level).toBe(7)
    expect(result.skill).not.toBeNull()
    expect(result.skill?.code).toBe("typescript")
  })

  test("rejects unregistered skill with skill_not_registered", async () => {
    const { context } = createTestContext()

    const result = await new GetMySkill(context).run({
      employeeId: 1,
      skillCode: "unknown",
    })

    expect(result).toEqual({ reason: "skill_not_registered" })
  })
})

describe("RemoveMySkill", () => {
  test("removes the registered skill", async () => {
    const { context, db } = createTestContext()

    await seedSkillMaster(db, "typescript")

    await new SetMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
      level: 5,
      years: null,
      note: null,
    })

    const result = await new RemoveMySkill(context).run({
      employeeId: 1,
      skillCode: "typescript",
    })

    expect(result).toEqual({ reason: "removed" })
  })

  test("rejects unregistered skill with skill_not_registered", async () => {
    const { context } = createTestContext()

    const result = await new RemoveMySkill(context).run({
      employeeId: 1,
      skillCode: "nonexistent",
    })

    expect(result).toEqual({ reason: "skill_not_registered" })
  })
})
