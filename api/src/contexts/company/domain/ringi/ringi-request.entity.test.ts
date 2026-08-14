import { describe, expect, test } from "bun:test"
import { RingiRequest } from "@/contexts/company/domain/ringi/ringi-request.entity"

describe("RingiRequest.create", () => {
  test("builds a pending ringi with an unassigned id and no decision", () => {
    const ringi = RingiRequest.create({
      applicantId: 5,
      approverId: 4,
      title: "New vendor",
      amount: 240000,
      reason: "faster builds",
      createdAt: "2026-05-11T01:00:00Z",
    })

    expect(ringi.id).toBeNull()
    expect(ringi.status).toBe("pending")
    expect(ringi.decidedAt).toBeNull()
    expect(ringi.decisionComment).toBeNull()
    expect(ringi.applicantId).toBe(5)
    expect(ringi.approverId).toBe(4)
  })

  test("is frozen (immutable)", () => {
    const ringi = RingiRequest.create({
      applicantId: 5,
      approverId: 4,
      title: "x",
      amount: 1,
      reason: "y",
      createdAt: "2026-05-11T01:00:00Z",
    })

    expect(Object.isFrozen(ringi)).toBe(true)
  })
})

describe("RingiRequest.fromRow", () => {
  test("reconstructs a decided ringi from a row", () => {
    const ringi = RingiRequest.fromRow({
      id: 2,
      applicantId: 5,
      approverId: 4,
      title: "Conference",
      amount: 500000,
      reason: "brand",
      status: "approved",
      decidedAt: "2026-05-13T02:00:00Z",
      decisionComment: "approved within budget",
      createdAt: "2026-05-12T02:00:00Z",
    })

    expect(ringi.id).toBe(2)
    expect(ringi.status).toBe("approved")
    expect(ringi.decisionComment).toBe("approved within budget")
  })
})
