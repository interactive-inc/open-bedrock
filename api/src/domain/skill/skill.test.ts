import { Skill } from "@/domain/skill/skill"
import { describe, expect, test } from "bun:test"

describe("Skill.fromRow", () => {
  test("builds from row data", () => {
    const skill = Skill.fromRow({
      code: "TS",
      name: "TypeScript",
      category: "programming",
    })

    expect(skill).toBeInstanceOf(Skill)
    expect(skill.code).toBe("TS")
    expect(skill.name).toBe("TypeScript")
    expect(skill.category).toBe("programming")
  })
})
