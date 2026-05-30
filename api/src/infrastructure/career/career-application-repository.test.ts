import { CareerApplication } from "@/domain/career/career-application"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("CareerApplicationRepository", () => {
  test("create then findByPostingAndApplicant round-trips the application", async () => {
    const { context } = createTestContext()

    const repository = new CareerApplicationRepository(context)

    const created = await repository.create(
      CareerApplication.create({
        postingId: 1,
        applicantId: 2,
        message: "応募します",
      }),
    )

    expect(created).toBeInstanceOf(CareerApplication)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findByPostingAndApplicant(1, 2)

    expect(found).toBeInstanceOf(CareerApplication)

    if (found instanceof Error || found === null) {
      throw new Error("findByPostingAndApplicant failed")
    }

    expect(found.id).toBe(created.id)
    expect(found.status).toBe("applied")
  })
})
