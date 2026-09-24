import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { EmployeeSkill } from "@/contexts/skill/domain/entities/employee-skill.entity"
import { Skill } from "@/contexts/skill/domain/entities/skill.entity"
import { SetMySkill } from "@/contexts/skill/application/set-my-skill"
import { ApplicationError, ConflictError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

function skillMaster(code: string): Skill {
  return new Skill({ code, name: `Skill ${code}`, category: "engineering" })
}

/** skill masterとemployee skillのRepositoryを型付きfakeにして、SetMySkillの業務判断だけを検証する。 */
function createSetMySkill(options: { skills?: ReadonlyArray<Skill>; saveError?: Error } = {}) {
  const saved: EmployeeSkill[] = []

  const setMySkill = new SetMySkill({
    skillRepository: {
      findByCode: async (code) => options.skills?.find((skill) => skill.code === code) ?? null,
    },
    employeeSkillRepository: {
      save: async (employeeSkill) => {
        if (options.saveError !== undefined) return options.saveError
        saved.push(employeeSkill)
        return employeeSkill
      },
    },
  })

  return { setMySkill, saved }
}

describe("SetMySkill", () => {
  test("registers a new skill for the employee", async () => {
    const { setMySkill, saved } = createSetMySkill({ skills: [skillMaster("typescript")] })

    const result = await setMySkill.run({
      employeeId: toWorkforceEmployeeId(1),
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
    expect(saved.map((skill) => [skill.employeeId, skill.skillCode])).toEqual([
      [toWorkforceEmployeeId(1), "typescript"],
    ])
  })

  test("passes the updated level, years and note to the repository", async () => {
    const { setMySkill, saved } = createSetMySkill({ skills: [skillMaster("typescript")] })

    const result = await setMySkill.run({
      employeeId: toWorkforceEmployeeId(1),
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
    expect(saved.at(0)?.note).toBe("advanced")
  })

  test("rejects unknown skill code with skill_not_found", async () => {
    const { setMySkill, saved } = createSetMySkill()

    const result = await setMySkill.run({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "nonexistent",
      level: 5,
      years: null,
      note: null,
    })

    expectApplicationError(result, NotFoundError, "skill_not_found")
    expect(saved).toEqual([])
  })

  test("maps a frozen record source to record_source_frozen", async () => {
    const { setMySkill } = createSetMySkill({
      skills: [skillMaster("typescript")],
      saveError: new Error("D1_ERROR: skill_record_source_frozen"),
    })

    const result = await setMySkill.run({
      employeeId: toWorkforceEmployeeId(1),
      skillCode: "typescript",
      level: 5,
      years: null,
      note: null,
    })

    expectApplicationError(result, ConflictError, "record_source_frozen")
  })
})
