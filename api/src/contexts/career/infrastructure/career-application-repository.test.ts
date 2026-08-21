import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/career-application.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

/** テスト用: career_postings に open な公募を挿入する。 */
async function seedOpenPosting(db: D1Database, postingId: number): Promise<void> {
  await db.exec(
    `INSERT INTO career_postings (id, title, status) VALUES (${postingId}, 'Test Posting', 'open')`,
  )
}

describe("CareerApplicationRepository", () => {
  test("create then findByPostingAndApplicant round-trips the application", async () => {
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)

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

  test("create returns posting_closed when the posting is not open", async () => {
    const { context, db } = createTestContext()
    await db.exec(
      "INSERT INTO career_postings (id, title, status) VALUES (1, 'Closed Posting', 'closed')",
    )

    const repository = new CareerApplicationRepository(context)

    const result = await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 2, message: null }),
    )

    expect(result).not.toBeInstanceOf(Error)
    expect(result).not.toBeInstanceOf(CareerApplication)

    if (result instanceof Error || result instanceof CareerApplication) {
      throw new Error("unexpected result")
    }

    expect(result.reason).toBe("posting_closed")
  })

  test("findByApplicantId returns the applicant's applications", async () => {
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)
    await seedOpenPosting(db, 2)

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
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)

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

  test("update returns application_decided when status is not applied", async () => {
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)

    const repository = new CareerApplicationRepository(context)

    const created = await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 8, message: "msg" }),
    )

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("create failed")
    }

    // 直接 status を変更して選考確定を模擬する
    await db.exec(`UPDATE career_applications SET status = 'accepted' WHERE id = ${created.id}`)

    const result = await repository.update(created.withMessage("updated"))

    expect(result).not.toBeInstanceOf(Error)
    expect(result).not.toBeInstanceOf(CareerApplication)

    if (result instanceof Error || result instanceof CareerApplication) {
      throw new Error("unexpected result")
    }

    expect(result.reason).toBe("application_decided")
  })

  test("delete removes the application", async () => {
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)

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

  test("delete returns application_decided when status is not applied", async () => {
    const { context, db } = createTestContext()
    await seedOpenPosting(db, 1)

    const repository = new CareerApplicationRepository(context)

    const created = await repository.create(
      CareerApplication.create({ postingId: 1, applicantId: 9, message: "x" }),
    )

    if (created instanceof Error || "reason" in created || created.id === null) {
      throw new Error("create failed")
    }

    // 直接 status を変更して選考確定を模擬する
    await db.exec(`UPDATE career_applications SET status = 'rejected' WHERE id = ${created.id}`)

    const result = await repository.delete(created.id)

    expect(result).not.toBe(null)

    if (result instanceof Error || result === null) {
      throw new Error("unexpected result")
    }

    expect(result.reason).toBe("application_decided")

    // 行が残っていることを確認
    const found = await repository.findById(created.id)
    expect(found).not.toBe(null)
  })
})
