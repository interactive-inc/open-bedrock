import { LeaveRequest } from "@/domain/leave/leave-request.entity"
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

describe("LeaveRequest.decide", () => {
  test("returns a new LeaveRequest with approved status and approver", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      days: 3,
      reason: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    const approved = request.decide({
      status: "approved",
      approverId: 2,
      decidedComment: "Approved",
    })

    expect(approved).toBeInstanceOf(LeaveRequest)
    expect(approved.status).toBe("approved")
    expect(approved.approverId).toBe(2)
    expect(approved.decidedComment).toBe("Approved")
    expect(approved.employeeId).toBe(7)
  })

  test("returns a new LeaveRequest with rejected status and approver", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "special",
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      days: 1,
      reason: "Personal",
      createdAt: "2026-07-20T09:00:00.000Z",
    })

    const rejected = request.decide({
      status: "rejected",
      approverId: 3,
      decidedComment: null,
    })

    expect(rejected.status).toBe("rejected")
    expect(rejected.approverId).toBe(3)
    expect(rejected.decidedComment).toBeNull()
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
      reason: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    expect(request.isModifiable).toBe(true)
  })

  test("is false for approved", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      days: 1,
      reason: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    const approved = request.decide({
      status: "approved",
      approverId: 2,
      decidedComment: null,
    })

    expect(approved.isModifiable).toBe(false)
  })

  test("is false for rejected", () => {
    const request = LeaveRequest.create({
      employeeId: 7,
      leaveType: "annual",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      days: 1,
      reason: null,
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    const rejected = request.decide({
      status: "rejected",
      approverId: 3,
      decidedComment: "Denied",
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
      reason: "Family trip",
      createdAt: "2026-06-15T09:00:00.000Z",
    })

    const revised = request.withRevised({
      leaveType: "special",
      startDate: "2026-08-10",
      endDate: "2026-08-12",
      days: 3,
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
