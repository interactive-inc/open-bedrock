import { ApplicationTemplate } from "@/domain/application/application-template.entity"
import { describe, expect, test } from "bun:test"

describe("ApplicationTemplate.fromRow", () => {
  test("builds an ApplicationTemplate from a row with valid JSON columns", () => {
    const template = ApplicationTemplate.fromRow({
      id: 31,
      code: "leave",
      name: "休暇申請",
      category: "leave",
      description: null,
      schemaJson: JSON.stringify({ fields: [] }),
      approverRoles: JSON.stringify(["manager", "hr"]),
    })

    expect(template).toBeInstanceOf(ApplicationTemplate)

    if (template instanceof Error) {
      throw template
    }

    expect(template.code).toBe("leave")
    expect(template.approverRoles.length).toBe(2)
    expect(template.approverRoles[0]).toBe("manager")
  })

  test("returns Error when schemaJson is not valid JSON", () => {
    const result = ApplicationTemplate.fromRow({
      id: 32,
      code: "broken-schema",
      name: "壊れたスキーマ",
      category: "leave",
      description: null,
      schemaJson: "{not-json",
      approverRoles: JSON.stringify(["manager"]),
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when approverRoles is not valid JSON", () => {
    const result = ApplicationTemplate.fromRow({
      id: 33,
      code: "broken-roles",
      name: "壊れたロール",
      category: "leave",
      description: null,
      schemaJson: "{}",
      approverRoles: "{not-json",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when approverRoles JSON is not an array", () => {
    const result = ApplicationTemplate.fromRow({
      id: 34,
      code: "wrong-roles-shape",
      name: "型違いのロール",
      category: "leave",
      description: null,
      schemaJson: "{}",
      approverRoles: JSON.stringify({ wrong: "shape" }),
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when approverRoles array contains a non-string item", () => {
    const result = ApplicationTemplate.fromRow({
      id: 35,
      code: "non-string-role",
      name: "数値混入",
      category: "leave",
      description: null,
      schemaJson: "{}",
      approverRoles: JSON.stringify(["manager", 1]),
    })

    expect(result).toBeInstanceOf(Error)
  })
})
