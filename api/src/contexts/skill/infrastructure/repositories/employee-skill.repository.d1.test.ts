import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/repositories/employee-skill.repository"
import { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["upsert"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("EmployeeSkillRepository on local D1", () => {
  test("save upserts by employee and skill code and the skill master is found", async () => {
    const { context, db } = await createLocalD1Context(local, "upsert")

    await seedD1(db, "skill_definitions", [
      { code: "typescript", name: "Skill typescript", category: "engineering" },
    ])

    const skill = await new SkillRepository(context).findByCode("typescript")

    expect(skill instanceof Error ? skill : skill?.code).toBe("typescript")

    const repository = new EmployeeSkillRepository(context)

    const first = await repository.save(
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "typescript",
        level: 5,
        years: 2,
        note: null,
      }),
    )

    expect(first).toBeInstanceOf(EmployeeSkill)

    const updated = await repository.save(
      EmployeeSkill.create({
        employeeId: toWorkforceEmployeeId(1),
        skillCode: "typescript",
        level: 8,
        years: 4,
        note: "advanced",
      }),
    )

    if (updated instanceof Error) throw updated

    expect(updated.level).toBe(8)
    expect(updated.years).toBe(4)
    expect(updated.note).toBe("advanced")

    const rows = await db
      .prepare("SELECT level, years, note FROM employee_skills WHERE skill_code = ?1")
      .bind("typescript")
      .all<{ level: number; years: number; note: string }>()

    expect(rows.results).toEqual([{ level: 8, years: 4, note: "advanced" }])
  })
})
