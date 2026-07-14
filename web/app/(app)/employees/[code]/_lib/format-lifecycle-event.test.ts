import {
  formatLifecycleDisplayStatus,
  formatLifecycleDate,
  formatLifecycleKind,
  summarizeLifecycleEvent,
} from "@/app/(app)/employees/[code]/_lib/format-lifecycle-event"
import { describe, expect, test } from "vite-plus/test"

describe("format lifecycle event", () => {
  test("uses business labels for event kinds and display states", () => {
    expect(formatLifecycleKind("transferred")).toBe("異動")
    expect(formatLifecycleDisplayStatus("scheduled")).toBe("予定")
    expect(formatLifecycleDate("2026-07-14")).toBe("2026年7月14日")
    expect(formatLifecycleDate("2026-02-30")).toBe("2026-02-30")
  })

  test("formats only the allowed organization snapshot fields", () => {
    expect(
      summarizeLifecycleEvent({
        department: { code: "D003", name: "Engineering" },
        previousPositionTitle: "Engineer",
        positionTitle: "Lead",
        previousManagerEmployeeCode: "E004",
        managerEmployeeCode: "E002",
        email: "private@example.com",
        reason: "private reason",
      }),
    ).toEqual(["部署: Engineering", "役職: Engineer → Lead", "上司: E004 → E002"])
  })
})
