import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { describe, expect, test } from "bun:test"

describe("Goal.create", () => {
  test("builds with draft status and null id", () => {
    const goal = Goal.create({
      employeeId: 1,
      period: "2026-H1",
      title: "売上目標",
      kpi: "月間売上100万円",
      weight: 50,
    })

    expect(goal).toBeInstanceOf(Goal)
    expect(goal.id).toBe(null)
    expect(goal.status).toBe("draft")
    expect(goal.employeeId).toBe(1)
    expect(goal.period).toBe("2026-H1")
    expect(goal.title).toBe("売上目標")
    expect(goal.kpi).toBe("月間売上100万円")
    expect(goal.weight).toBe(50)
  })

  test("accepts weight 1", () => {
    const goal = Goal.create({
      employeeId: 1,
      period: "2026-H1",
      title: "目標",
      kpi: null,
      weight: 1,
    })

    expect(goal).toBeInstanceOf(Goal)
    expect(goal.weight).toBe(1)
  })

  test("accepts weight 100", () => {
    const goal = Goal.create({
      employeeId: 1,
      period: "2026-H1",
      title: "目標",
      kpi: null,
      weight: 100,
    })

    expect(goal).toBeInstanceOf(Goal)
    expect(goal.weight).toBe(100)
  })

  test("throws on weight 0", () => {
    expect(() =>
      Goal.create({
        employeeId: 1,
        period: "2026-H1",
        title: "目標",
        kpi: null,
        weight: 0,
      }),
    ).toThrow()
  })

  test("throws on weight 101", () => {
    expect(() =>
      Goal.create({
        employeeId: 1,
        period: "2026-H1",
        title: "目標",
        kpi: null,
        weight: 101,
      }),
    ).toThrow()
  })

  test("throws on negative weight", () => {
    expect(() =>
      Goal.create({
        employeeId: 1,
        period: "2026-H1",
        title: "目標",
        kpi: null,
        weight: -1,
      }),
    ).toThrow()
  })
})

describe("Goal.withStatus", () => {
  test("returns new Goal with changed status", () => {
    const goal = Goal.create({
      employeeId: 1,
      period: "2026-H1",
      title: "目標",
      kpi: null,
      weight: 30,
    })

    const submitted = goal.withStatus("submitted")

    expect(submitted).toBeInstanceOf(Goal)
    expect(submitted.status).toBe("submitted")
    expect(submitted.title).toBe("目標")
    expect(goal.status).toBe("draft")
  })
})

describe("Goal.withDetails", () => {
  test("returns new Goal with changed details", () => {
    const goal = Goal.create({
      employeeId: 1,
      period: "2026-H1",
      title: "旧タイトル",
      kpi: null,
      weight: 30,
    })

    const updated = goal.withDetails({
      period: "2026-H2",
      title: "新タイトル",
      kpi: "KPI指標",
      weight: 70,
    })

    expect(updated).toBeInstanceOf(Goal)
    expect(updated.period).toBe("2026-H2")
    expect(updated.title).toBe("新タイトル")
    expect(updated.kpi).toBe("KPI指標")
    expect(updated.weight).toBe(70)
    expect(updated.employeeId).toBe(1)
    expect(updated.status).toBe("draft")
  })
})
