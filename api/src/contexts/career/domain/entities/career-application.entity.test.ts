import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { uuidSchema } from "@/lib/uuid/uuid.schema"
import { describe, expect, test } from "bun:test"

describe("CareerApplication.create", () => {
  test("採番済みの id と applied 状態で組み立てる", () => {
    const application = CareerApplication.create({
      postingId: "0190000d-0000-7000-8000-000000000001",
      applicantId: toWorkforceEmployeeId(5),
      message: "I am interested",
    })

    expect(application).toBeInstanceOf(CareerApplication)
    expect(uuidSchema.safeParse(application.id).success).toBe(true)
    expect(application.status).toBe("applied")
    expect(application.message).toBe("I am interested")
  })

  test("accepts null message", () => {
    const application = CareerApplication.create({
      postingId: "0190000d-0000-7000-8000-000000000001",
      applicantId: toWorkforceEmployeeId(5),
      message: null,
    })

    expect(application.message).toBe(null)
  })
})

describe("CareerApplication.withMessage", () => {
  test("returns new application with changed message", () => {
    const application = CareerApplication.create({
      postingId: "0190000d-0000-7000-8000-000000000001",
      applicantId: toWorkforceEmployeeId(5),
      message: "original",
    })

    const updated = application.withMessage("updated message")

    expect(updated.message).toBe("updated message")
    expect(updated.postingId).toBe("0190000d-0000-7000-8000-000000000001")
  })
})
