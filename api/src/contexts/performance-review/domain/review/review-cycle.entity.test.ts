import { ReviewCycle } from "@/contexts/performance-review/domain/review/review-cycle.entity"
import { describe, expect, test } from "bun:test"

describe("ReviewCycle.create", () => {
  test("builds a cycle with draft status and null id", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: "2026-06-30",
    })

    expect(cycle).toBeInstanceOf(ReviewCycle)
    expect(cycle.id).toBe(null)
    expect(cycle.status).toBe("draft")
    expect(cycle.title).toBe("2026H1")
    expect(cycle.dueDate).toBe("2026-06-30")
  })

  test("accepts null dueDate", () => {
    const cycle = ReviewCycle.create({
      title: "2026H2",
      period: "2026-H2",
      dueDate: null,
    })

    expect(cycle.dueDate).toBe(null)
  })
})

describe("ReviewCycle.open", () => {
  test("transitions draft to open", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const opened = cycle.open()

    expect(opened).toBeInstanceOf(ReviewCycle)
    expect(opened?.status).toBe("open")
  })

  test("returns null for non-draft", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const opened = cycle.open()

    if (opened === null) {
      throw new Error("expected open to succeed")
    }

    const openedAgain = opened.open()

    expect(openedAgain).toBe(null)
  })
})

describe("ReviewCycle.close", () => {
  test("transitions open to closed", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const opened = cycle.open()

    if (opened === null) {
      throw new Error("expected open to succeed")
    }

    const closed = opened.close()

    expect(closed).toBeInstanceOf(ReviewCycle)
    expect(closed?.status).toBe("closed")
  })

  test("returns null for non-open", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const closed = cycle.close()

    expect(closed).toBe(null)
  })
})

describe("ReviewCycle.isDeletable", () => {
  test("is true for draft", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    expect(cycle.isDeletable).toBe(true)
  })

  test("is false for open", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const opened = cycle.open()

    if (opened === null) {
      throw new Error("expected open to succeed")
    }

    expect(opened.isDeletable).toBe(false)
  })
})

describe("ReviewCycle.withDetails", () => {
  test("returns new cycle with changed details", () => {
    const cycle = ReviewCycle.create({
      title: "2026H1",
      period: "2026-H1",
      dueDate: null,
    })

    const updated = cycle.withDetails({
      title: "2026H2",
      period: "2026-H2",
      dueDate: "2026-12-31",
    })

    expect(updated.title).toBe("2026H2")
    expect(updated.period).toBe("2026-H2")
    expect(updated.dueDate).toBe("2026-12-31")
    expect(updated.status).toBe("draft")
  })
})
