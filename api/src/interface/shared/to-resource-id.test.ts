import { describe, expect, test } from "bun:test"
import { toResourceId } from "@/interface/shared/to-resource-id"

describe("toResourceId", () => {
  test("accepts a valid UUID v4", () => {
    expect(toResourceId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    )
  })
  test("rejects an empty string", () => {
    expect(toResourceId("")).toBeNull()
  })
  test("rejects a plain number", () => {
    expect(toResourceId("12345")).toBeNull()
  })
  test("rejects a string that is too long", () => {
    expect(toResourceId("a".repeat(1000))).toBeNull()
  })
  test("rejects uppercase UUID", () => {
    expect(toResourceId("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")).toBeNull()
  })
  test("rejects UUID without hyphens", () => {
    expect(toResourceId("a1b2c3d4e5f67890abcdef1234567890")).toBeNull()
  })
  test("rejects a string with trailing garbage", () => {
    expect(toResourceId("a1b2c3d4-e5f6-7890-abcd-ef1234567890xxx")).toBeNull()
  })
})
