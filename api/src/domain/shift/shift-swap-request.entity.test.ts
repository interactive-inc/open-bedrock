import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request.entity"
import { describe, expect, test } from "bun:test"

describe("ShiftSwapRequest.create", () => {
  test("builds with pending status when requester differs from target", () => {
    const swap = ShiftSwapRequest.create({
      requesterEmployeeId: 1,
      targetEmployeeId: 2,
      date: "2026-06-20",
      note: "Please swap shifts",
    })

    expect(swap).toBeInstanceOf(ShiftSwapRequest)

    const request = swap as ShiftSwapRequest

    expect(request.id).toBeNull()
    expect(request.status).toBe("pending")
    expect(request.approvedAt).toBeNull()
    expect(request.requesterEmployeeId).toBe(1)
    expect(request.targetEmployeeId).toBe(2)
    expect(request.date).toBe("2026-06-20")
    expect(request.note).toBe("Please swap shifts")
  })

  test("returns self_reference reason when requester equals target", () => {
    const swap = ShiftSwapRequest.create({
      requesterEmployeeId: 5,
      targetEmployeeId: 5,
      date: "2026-06-20",
      note: null,
    })

    expect(swap).not.toBeInstanceOf(ShiftSwapRequest)
    expect((swap as { reason: string }).reason).toBe("self_reference")
  })
})

describe("ShiftSwapRequest.withApproved", () => {
  test("returns new with approved status and approvedAt", () => {
    const swap = ShiftSwapRequest.create({
      requesterEmployeeId: 1,
      targetEmployeeId: 2,
      date: "2026-06-20",
      note: null,
    }) as ShiftSwapRequest

    const approved = swap.withApproved("2026-06-18T10:00:00.000Z")

    expect(approved).toBeInstanceOf(ShiftSwapRequest)
    expect(approved.status).toBe("approved")
    expect(approved.approvedAt).toBe("2026-06-18T10:00:00.000Z")
    expect(approved.requesterEmployeeId).toBe(1)
    expect(approved.targetEmployeeId).toBe(2)
  })
})
