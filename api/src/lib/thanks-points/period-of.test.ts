import { periodOf } from "@/lib/thanks-points/period-of"
import { describe, expect, test } from "bun:test"

describe("periodOf", () => {
  test("extracts YYYY-MM from ISO datetime string", () => {
    expect(periodOf("2026-01-15T10:30:00.000Z")).toBe("2026-01")
  })

  test("extracts YYYY-MM from another month", () => {
    expect(periodOf("2025-12-31T23:59:59.999Z")).toBe("2025-12")
  })
})
