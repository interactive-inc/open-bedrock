import { canCreateOneOnOne } from "@/domain/oneonone/can-create-one-on-one"
import { describe, expect, test } from "bun:test"

describe("canCreateOneOnOne", () => {
  test("manager can create", () => {
    expect(canCreateOneOnOne("manager")).toBe(true)
  })

  test("hr can create", () => {
    expect(canCreateOneOnOne("hr")).toBe(true)
  })

  test("admin can create", () => {
    expect(canCreateOneOnOne("admin")).toBe(true)
  })

  test("member cannot create", () => {
    expect(canCreateOneOnOne("member")).toBe(false)
  })

  test("unknown role cannot create", () => {
    expect(canCreateOneOnOne("viewer")).toBe(false)
  })
})
