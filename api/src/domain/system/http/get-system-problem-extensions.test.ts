import { describe, expect, test } from "bun:test"
import { getSystemProblemExtensions } from "@system/domain/http/get-system-problem-extensions"

describe("getSystemProblemExtensions", () => {
  test("retains existing public diagnostics but removes reserved and internal members", () => {
    const body = {
      type: "https://attacker.example/problem",
      title: "spoofed",
      status: 200,
      detail: "spoofed",
      instance: "/spoofed",
      code: "spoofed",
      error: "legacy error",
      message: "legacy message",
      cause: new Error("database credentials"),
      stack: "internal stack",
      constructor: "spoofed",
      issues: [{ path: ["name"], message: "required" }],
      entityId: "entity-1",
    }
    Object.defineProperty(body, "getter", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute getters")
      },
    })

    const extensions = getSystemProblemExtensions(body)

    expect(extensions).toEqual({
      issues: [{ path: ["name"], message: "required" }],
      entityId: "entity-1",
    })
    expect(JSON.stringify(extensions)).not.toContain("database credentials")
    expect(JSON.stringify(extensions)).not.toContain("internal stack")
  })
})
