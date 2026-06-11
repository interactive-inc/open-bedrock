import { OneOnOne } from "@/domain/oneonone/one-on-one"
import { describe, expect, test } from "bun:test"

describe("OneOnOne.create", () => {
  test("builds instance with UUID id when member and manager differ", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: "Career growth",
      managerNote: "Good progress",
      nextAction: "Set quarterly goals",
    })

    expect(record).toBeInstanceOf(OneOnOne)

    if ("reason" in record) {
      throw new Error("expected success")
    }

    expect(record.id.length).toBeGreaterThan(0)
    expect(record.memberId).toBe(1)
    expect(record.managerId).toBe(2)
  })

  test("returns self_reference when member equals manager", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 1,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expect(record).toEqual({ reason: "self_reference" })
  })
})

describe("OneOnOne.withRecord", () => {
  test("returns new with changed topics, note, and action", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in record) {
      throw new Error("expected success")
    }

    const updated = record.withRecord({
      topics: "Performance review",
      managerNote: "Needs improvement",
      nextAction: "Training plan",
    })

    expect(updated.topics).toBe("Performance review")
    expect(updated.managerNote).toBe("Needs improvement")
    expect(updated.nextAction).toBe("Training plan")
  })
})

describe("OneOnOne update methods", () => {
  test("updateTopics returns new with changed topics", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in record) {
      throw new Error("expected success")
    }

    const updated = record.updateTopics("New topic")

    expect(updated.topics).toBe("New topic")
  })

  test("updateManagerNote returns new with changed note", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in record) {
      throw new Error("expected success")
    }

    const updated = record.updateManagerNote("Note")

    expect(updated.managerNote).toBe("Note")
  })

  test("updateNextAction returns new with changed action", () => {
    const record = OneOnOne.create({
      memberId: 1,
      managerId: 2,
      heldAt: "2026-01-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    if ("reason" in record) {
      throw new Error("expected success")
    }

    const updated = record.updateNextAction("Follow up")

    expect(updated.nextAction).toBe("Follow up")
  })
})
