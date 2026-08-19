import { Grade } from "@/contexts/company/domain/grade/grade.entity"
import { describe, expect, test } from "bun:test"

describe("Grade.create", () => {
  test("builds an unsaved grade with null id", () => {
    const grade = Grade.create({
      code: "G1",
      name: "Associate",
      rank: 1,
      description: "Entry level",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(grade).toBeInstanceOf(Grade)
    expect(grade.id).toBe(null)
    expect(grade.code).toBe("G1")
    expect(grade.rank).toBe(1)
    expect(grade.description).toBe("Entry level")
  })
})

describe("Grade.withDetails", () => {
  test("returns a new instance with updated definition", () => {
    const grade = Grade.create({
      code: "G1",
      name: "Associate",
      rank: 1,
      description: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const updated = grade.withDetails({
      code: "G1",
      name: "Associate II",
      rank: 2,
      description: "updated",
    })

    expect(updated).toBeInstanceOf(Grade)
    expect(updated.name).toBe("Associate II")
    expect(updated.rank).toBe(2)
    expect(updated.description).toBe("updated")
    expect(updated.createdAt).toBe("2026-01-01T00:00:00.000Z")
  })
})
