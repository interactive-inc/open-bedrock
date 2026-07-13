import { generateReviewForms } from "@/application/review/generate-review-forms"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

describe("generateReviewForms", () => {
  test("creates self, manager, peer and subordinate assignments from the organization", async () => {
    const { context, db } = createTestContext()
    await seedD1(db, "employees", [
      { id: 2, code: "E002", name: "Manager", status: "active" },
      { id: 5, code: "E005", name: "Member A", status: "active" },
      { id: 6, code: "E006", name: "Member B", status: "active" },
      { id: 9, code: "E009", name: "Inactive", status: "retired" },
    ])
    await seedD1(db, "org_memberships", [
      { department_code: "HQ", employee_code: "E002", manager_employee_code: null },
      { department_code: "TEAM", employee_code: "E005", manager_employee_code: "E002" },
      { department_code: "TEAM", employee_code: "E006", manager_employee_code: "E002" },
    ])
    await seedD1(db, "review_cycles", [
      { id: 1, title: "Review", period: "2026-H1", status: "draft", due_date: null },
    ])

    const generated = await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: true,
        include_subordinates: true,
        peer_count: 0,
      },
    })
    expect(generated).toBe(9)

    const rows = await db.prepare("SELECT * FROM review_forms ORDER BY id").all()
    expect(rows.results).toHaveLength(9)
    expect(rows.results).toContainEqual(
      expect.objectContaining({
        subject_employee_id: 5,
        reviewer_employee_id: 2,
        reviewer_type: "manager",
      }),
    )
    expect(rows.results).toContainEqual(
      expect.objectContaining({
        subject_employee_id: 2,
        reviewer_employee_id: 5,
        reviewer_type: "subordinate",
      }),
    )

    await generateReviewForms({
      c: context,
      cycleId: 1,
      policy: {
        include_self: true,
        include_manager: true,
        include_peers: true,
        include_subordinates: true,
        peer_count: 0,
      },
    })
    const afterRetry = await db
      .prepare("SELECT COUNT(*) AS total FROM review_forms")
      .first<{ total: number }>()
    expect(afterRetry?.total).toBe(9)
  })
})
