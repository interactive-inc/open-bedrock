import { ApplicationApproval } from "@/contexts/request/domain/application-approval.entity"
import { describe, expect, test } from "bun:test"

describe("ApplicationApproval.create", () => {
  test("builds with null id and approve action", () => {
    const approval = ApplicationApproval.create({
      applicationId: 10,
      approverId: 3,
      action: "approve",
      comment: "Approved",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(approval).toBeInstanceOf(ApplicationApproval)
    expect(approval.id).toBe(null)
    expect(approval.action).toBe("approve")
  })

  test("builds with null id and reject action", () => {
    const approval = ApplicationApproval.create({
      applicationId: 10,
      approverId: 3,
      action: "reject",
      comment: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(approval.action).toBe("reject")
    expect(approval.comment).toBe(null)
  })
})

describe("ApplicationApproval.fromRow", () => {
  test("builds from row with approve action", () => {
    const approval = ApplicationApproval.fromRow({
      id: 1,
      applicationId: 10,
      approverId: 3,
      action: "approve",
      comment: "OK",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (approval instanceof Error) {
      throw approval
    }

    expect(approval).toBeInstanceOf(ApplicationApproval)
    expect(approval.action).toBe("approve")
  })

  test("builds from row with reject action", () => {
    const approval = ApplicationApproval.fromRow({
      id: 2,
      applicationId: 10,
      approverId: 3,
      action: "reject",
      comment: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (approval instanceof Error) {
      throw approval
    }

    expect(approval.action).toBe("reject")
  })

  test("returns Error for invalid action", () => {
    const approval = ApplicationApproval.fromRow({
      id: 3,
      applicationId: 10,
      approverId: 3,
      action: "invalid",
      comment: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(approval).toBeInstanceOf(Error)
  })
})
