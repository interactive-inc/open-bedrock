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

    if (created instanceof Error || "reason" in created || created.id === null) {
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

  test("findByApplicantId returns the applicant's applications", async () => {
    const { context } = createTestContext()

    const repository = new CareerApplicationRepository(context)

    await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 7, message: "a" }),
    )

    await repository.create(
      CareerApplication.create({ postingId: 2, applicantId: 7, message: "b" }),
    )

    const applications = await repository.findByApplicantId({
      applicantId: 7,
      limit: 50,
      offset: 0,
    })

    expect(applications).not.toBeInstanceOf(Error)

    if (applications instanceof Error) {
      throw new Error("findByApplicantId failed")
    }

    expect(applications.length).toBe(2)
  })

  test("update changes the message and findById round-trips it", async () => {
    const { context } = createTestContext()

    const repository = new CareerApplicationRepository(context)

    const created = await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 8, message: "before" }),
    )

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("create failed")
    }

    await repository.update(created.withMessage("after"))

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.message).toBe("after")
  })

  test("delete removes the application", async () => {
    const { context } = createTestContext()

    const repository = new CareerApplicationRepository(context)

    const created = await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 9, message: "x" }),
    )

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("create failed")
    }

    await repository.delete(created.id)

    const found = await repository.findById(created.id)

    expect(found).toBe(null)
  })
})
