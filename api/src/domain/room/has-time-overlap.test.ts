import { hasTimeOverlap } from "@/domain/room/has-time-overlap"
import { describe, expect, test } from "bun:test"

describe("hasTimeOverlap", () => {
  test("overlapping ranges return true", () => {
    expect(
      hasTimeOverlap({
        startAt: "2026-06-11T10:00:00.000Z",
        endAt: "2026-06-11T12:00:00.000Z",
        otherStartAt: "2026-06-11T11:00:00.000Z",
        otherEndAt: "2026-06-11T13:00:00.000Z",
      }),
    ).toBe(true)
  })

  test("non-overlapping ranges return false", () => {
    expect(
      hasTimeOverlap({
        startAt: "2026-06-11T10:00:00.000Z",
        endAt: "2026-06-11T11:00:00.000Z",
        otherStartAt: "2026-06-11T12:00:00.000Z",
        otherEndAt: "2026-06-11T13:00:00.000Z",
      }),
    ).toBe(false)
  })

  test("adjacent ranges return false", () => {
    expect(
      hasTimeOverlap({
        startAt: "2026-06-11T10:00:00.000Z",
        endAt: "2026-06-11T11:00:00.000Z",
        otherStartAt: "2026-06-11T11:00:00.000Z",
        otherEndAt: "2026-06-11T12:00:00.000Z",
      }),
    ).toBe(false)
  })

  test("contained ranges return true", () => {
    expect(
      hasTimeOverlap({
        startAt: "2026-06-11T10:00:00.000Z",
        endAt: "2026-06-11T14:00:00.000Z",
        otherStartAt: "2026-06-11T11:00:00.000Z",
        otherEndAt: "2026-06-11T13:00:00.000Z",
      }),
    ).toBe(true)
  })
})
