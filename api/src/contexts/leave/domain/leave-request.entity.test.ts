import { LeaveRequest } from "@/contexts/leave/domain/leave-request.entity"
import { describe, expect, test } from "bun:test"

describe("LeaveRequest.daysBetween", () => {
  test("same day returns 1", () => {
    expect(LeaveRequest.daysBetween("2026-07-01", "2026-07-01")).toBe(1)
  })

  test("multi-day range returns correct count", () => {
    expect(LeaveRequest.daysBetween("2026-07-01", "2026-07-05")).toBe(5)
  })

  test("two consecutive days returns 2", () => {
    expect(LeaveRequest.daysBetween("2026-07-01", "2026-07-02")).toBe(2)
  })

  test("end before start returns Error", () => {
    expect(LeaveRequest.daysBetween("2026-07-05", "2026-07-01")).toBeInstanceOf(Error)
  })

  test("invalid start date returns Error", () => {
    expect(LeaveRequest.daysBetween("not-a-date", "2026-07-01")).toBeInstanceOf(Error)
  })

  test("invalid end date returns Error", () => {
    expect(LeaveRequest.daysBetween("2026-07-01", "not-a-date")).toBeInstanceOf(Error)
  })
})

describe("LeaveRequest.create", () => {
  test("builds a LeaveRequest with pending status and null id", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      days: 3,
      unit: "full_day",
      hours: null,
      consumedDays: 3,
      reason: "Family trip",
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    expect(request).toBeInstanceOf(LeaveRequest)
    expect(request.id).toBeNull()
    expect(request.status).toBe("pending")
    expect(request.approverId).toBeNull()
    expect(request.decidedComment).toBeNull()
    expect(request.employeeId).toBe(7)
    expect(request.leaveType).toBe("annual")
    expect(request.startDate).toBe("2026-07-01")
    expect(request.endDate).toBe("2026-07-03")
    expect(request.days).toBe(3)
    expect(request.reason).toBe("Family trip")
  })
})

describe("LeaveRequest.isModifiable", () => {
  test("is true for pending", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      days: 1,
      unit: "full_day",
      hours: null,
      consumedDays: 1,
      reason: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    expect(request.isModifiable).toBe(true)
  })

  test("is false for approved", () => {
    const approved = new LeaveRequest({
      id: null,
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      days: 1,
      unit: "full_day",
      hours: null,
      consumedDays: 1,
      reason: null,
      status: "approved",
      approverId: 2,
      decidedComment: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    expect(approved.isModifiable).toBe(false)
  })

  test("is false for rejected", () => {
    const rejected = new LeaveRequest({
      id: null,
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      days: 1,
      unit: "full_day",
      hours: null,
      consumedDays: 1,
      reason: null,
      status: "rejected",
      approverId: 3,
      decidedComment: "Denied",
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    expect(rejected.isModifiable).toBe(false)
  })
})

describe("LeaveRequest.withRevised", () => {
  test("returns a new LeaveRequest with the changed details", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      days: 3,
      unit: "full_day",
      hours: null,
      consumedDays: 3,
      reason: "Family trip",
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    const revised = request.withRevised({
      leaveType: "special",
      startDate: "2026-08-10",
      endDate: "2026-08-12",
      days: 3,
      unit: "full_day",
      hours: null,
      consumedDays: 3,
      reason: "Wedding",
    })

    expect(revised).toBeInstanceOf(LeaveRequest)
    expect(revised.leaveType).toBe("special")
    expect(revised.startDate).toBe("2026-08-10")
    expect(revised.endDate).toBe("2026-08-12")
    expect(revised.reason).toBe("Wedding")
    expect(revised.employeeId).toBe(7)
    expect(revised.status).toBe("pending")
  })
})
