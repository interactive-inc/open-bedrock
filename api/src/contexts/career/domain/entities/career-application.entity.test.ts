import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { describe, expect, test } from "bun:test"

describe("CareerApplication.create", () => {
  test("builds with null id and applied status", () => {
    const application = CareerApplication.create({
      postingId: 1,
      applicantId: toWorkforceEmployeeId(5),
      message: "I am interested",
    })

    expect(application).toBeInstanceOf(CareerApplication)
    expect(application.id).toBe(null)
    expect(application.status).toBe("applied")
    expect(application.message).toBe("I am interested")
  })

  test("accepts null message", () => {
    const application = CareerApplication.create({
      postingId: 1,
      applicantId: toWorkforceEmployeeId(5),
      message: null,
    })

    expect(application.message).toBe(null)
  })
})

describe("CareerApplication.withMessage", () => {
  test("returns new application with changed message", () => {
    const application = CareerApplication.create({
      postingId: 1,
      applicantId: toWorkforceEmployeeId(5),
      message: "original",
    })

    const updated = application.withMessage("updated message")

    expect(updated.message).toBe("updated message")
    expect(updated.postingId).toBe(1)
  })
})
