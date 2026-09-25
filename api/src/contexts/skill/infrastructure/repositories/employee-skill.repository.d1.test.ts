import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/repositories/employee-skill.repository"
import { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "upsert",
      "save-round-trips-the-employee-skill",
      "delete-returns-null-for-non-existent-skill",
      "delete-returns-true-for-existing-skill",
      "delete-returns-null-on-second-delete-of-same",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("EmployeeSkillRepository on local D1", () => {
  test("save upserts by employee and skill code and the skill master is found", async () => {
    const { context, db } = await createLocalD1Context(local, "upsert")

    await seedD1(db, "skill_definitions", [
      {
        id: crypto.randomUUID(),
        code: "typescript",
        name: "Skill typescript",
        category: "engineering",
      },
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

describe("EmployeeSkillRepository", () => {
  test("save round-trips the employee skill", async () => {
    const { context } = await createLocalD1Context(local, "save-round-trips-the-employee-skill")

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
    const { context } = await createLocalD1Context(
      local,
      "delete-returns-null-for-non-existent-skill",
    )

    const repository = new EmployeeSkillRepository(context)

    const deleted = await repository.delete({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "UNKNOWN",
    })

    expect(deleted).toBeNull()
  })

  test("delete returns true for existing skill", async () => {
    const { context } = await createLocalD1Context(local, "delete-returns-true-for-existing-skill")

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
    const { context } = await createLocalD1Context(
      local,
      "delete-returns-null-on-second-delete-of-same",
    )

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
