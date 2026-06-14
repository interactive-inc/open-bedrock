import { Application } from "@/domain/application/application.entity"
import { describe, expect, test } from "bun:test"

describe("Application.fromRow", () => {
  test("builds an Application from a row with valid payload JSON", () => {
    const application = Application.fromRow({
      id: 21,
      templateId: 3,
      applicantId: 9,
      status: "pending",
      currentStep: "manager",
      payload: JSON.stringify({ reason: "出張" }),
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(application).toBeInstanceOf(Application)

    if (application instanceof Error) {
      throw application
    }

    expect(application.id).toBe(21)
    expect(application.status).toBe("pending")
    expect(application.currentStep).toBe("manager")
  })

  test("returns Error when status is unknown", () => {
    const result = Application.fromRow({
      id: 22,
      templateId: 3,
      applicantId: 9,
      status: "unknown",
      currentStep: null,
      payload: "{}",
      createdAt: "2026-02-02T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when payload is not valid JSON", () => {
    const result = Application.fromRow({
      id: 23,
      templateId: 3,
      applicantId: 9,
      status: "pending",
      currentStep: null,
      payload: "{not-json",
      createdAt: "2026-02-03T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
  })
})
