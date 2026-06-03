import { Application } from "@/domain/application/application"
import { GetApplication } from "@/application/application/get-application"
import { ListMyApplications } from "@/application/application/list-my-applications"
import { UpdateApplication } from "@/application/application/update-application"
import { WithdrawApplication } from "@/application/application/withdraw-application"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

async function seedPending(
  repository: ApplicationRepository,
  applicantId: number,
): Promise<Application> {
  const created = await repository.create(
    Application.create({
      templateId: 1,
      applicantId: applicantId,
      currentStep: "manager_approval",
      payload: { reason: "initial" },
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error) {
    throw created
  }

  return created
}

describe("GetApplication", () => {
  test("returns the application for the applicant", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new GetApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 5,
    })

    expect(result).toBeInstanceOf(Application)
  })

  test("returns not_applicant for another employee", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new GetApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 9,
    })

    if (result instanceof Error || result instanceof Application) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("not_applicant")
  })

  test("returns application_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetApplication(context).run({
      applicationId: 9999,
      applicantId: 5,
    })

    if (result instanceof Error || result instanceof Application) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("application_not_found")
  })
})

describe("ListMyApplications", () => {
  test("returns only the applicant's applications", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    await seedPending(repository, 5)

    await seedPending(repository, 5)

    await seedPending(repository, 9)

    const result = await new ListMyApplications(context).run({ applicantId: 5 })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(2)
  })
})

describe("UpdateApplication", () => {
  test("updates the payload of a pending application for the applicant", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new UpdateApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 5,
      payload: { reason: "updated" },
    })

    if (result instanceof Error || !(result instanceof Application)) {
      throw new Error("expected the updated application")
    }

    expect(result.payload).toEqual({ reason: "updated" })
  })

  test("returns not_applicant for another employee", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new UpdateApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 9,
      payload: {},
    })

    if (result instanceof Error || result instanceof Application) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("not_applicant")
  })

  test("returns not_pending once the application is decided", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    await repository.update(created.withStatus("approved"))

    const result = await new UpdateApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 5,
      payload: {},
    })

    if (result instanceof Error || result instanceof Application) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("not_pending")
  })
})

describe("WithdrawApplication", () => {
  test("withdraws a pending application for the applicant", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new WithdrawApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 5,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("withdrawn")

    const found = await repository.findById(created.id ?? 0)

    expect(found).toBeNull()
  })

  test("returns not_applicant for another employee", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    const result = await new WithdrawApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 9,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("not_applicant")
  })

  test("returns not_pending once the application is decided", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await seedPending(repository, 5)

    await repository.update(created.withStatus("rejected"))

    const result = await new WithdrawApplication(context).run({
      applicationId: created.id ?? 0,
      applicantId: 5,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("not_pending")
  })
})
