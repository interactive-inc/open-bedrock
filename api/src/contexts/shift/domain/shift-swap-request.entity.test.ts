import { ShiftSwapRequest } from "@/contexts/shift/domain/shift-swap-request.entity"
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

    if (swap instanceof ShiftSwapRequest) {
      expect(swap.id).toBeNull()
      expect(swap.status).toBe("pending")
      expect(swap.approvedAt).toBeNull()
      expect(swap.requesterEmployeeId).toBe(1)
      expect(swap.targetEmployeeId).toBe(2)
      expect(swap.date).toBe("2026-06-20")
      expect(swap.note).toBe("Please swap shifts")
    }
  })

  test("returns self_reference reason when requester equals target", () => {
    const swap = ShiftSwapRequest.create({
      requesterEmployeeId: 5,
      targetEmployeeId: 5,
      date: "2026-06-20",
      note: null,
    })

    expect(swap).not.toBeInstanceOf(ShiftSwapRequest)

    if (!(swap instanceof ShiftSwapRequest)) {
      expect(swap.reason).toBe("self_reference")
    }
  })
})

describe("ShiftSwapRequest.withApproved", () => {
  test("returns new with approved status and approvedAt", () => {
    const swap = ShiftSwapRequest.create({
      requesterEmployeeId: 1,
      targetEmployeeId: 2,
      date: "2026-06-20",
      note: null,
    })

    expect(swap).toBeInstanceOf(ShiftSwapRequest)

    if (swap instanceof ShiftSwapRequest) {
      const approved = swap.withApproved("2026-06-18T10:00:00.000Z")

      expect(approved).toBeInstanceOf(ShiftSwapRequest)
      expect(approved.status).toBe("approved")
      expect(approved.approvedAt).toBe("2026-06-18T10:00:00.000Z")
      expect(approved.requesterEmployeeId).toBe(1)
      expect(approved.targetEmployeeId).toBe(2)
    }
  })
})
