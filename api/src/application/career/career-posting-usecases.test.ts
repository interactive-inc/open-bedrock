import { describe, expect, test } from "bun:test"
import { ApplyToCareerPosting } from "@/application/career/apply-to-career-posting"
import { CreateCareerPosting } from "@/application/career/create-career-posting"
import { DeleteCareerPosting } from "@/application/career/delete-career-posting"
import { GetCareerPosting } from "@/application/career/get-career-posting"
import { UpdateCareerPosting } from "@/application/career/update-career-posting"
import { CareerPosting } from "@/domain/career/career-posting.entity"
import { CareerApplicationRepository } from "@/infrastructure/career/career-application-repository"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"

async function seedPosting(context: Context): Promise<number> {
  const created = await new CreateCareerPosting(context).run({
    session: makeTestSession("root"),
    title: "Platform Engineer",
    deptId: 3,
    deptName: "Engineering",
    requiredSkills: "typescript",
    status: "open",
  })

  if (created instanceof ApplicationError || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateCareerPosting", () => {
  test("admin creates a posting and the DB assigns an id", async () => {
    const { context } = createTestContext()

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("hr"),
      title: "Data Analyst",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    expect(created).toBeInstanceOf(CareerPosting)

    if (created instanceof ApplicationError) {
      throw new Error("create failed")
    }

    expect(created.id).not.toBe(null)
    expect(created.status).toBe("open")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("member"),
      title: "X",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    expect(created instanceof CareerPosting).toBe(false)

    expectApplicationError(created, ForbiddenError, "forbidden")
  })
})

describe("GetCareerPosting", () => {
  test("admin reads an existing posting", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new GetCareerPosting(context).run({
      postingId: postingId,
    })

    expect(result).toBeInstanceOf(CareerPosting)
  })

  test("returns posting_not_found for a missing id", async () => {
    const { context } = createTestContext()

    const result = await new GetCareerPosting(context).run({
      postingId: 9999,
    })

    expectApplicationError(result, NotFoundError, "posting_not_found")
  })

  test("a member can read a posting to apply", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new GetCareerPosting(context).run({
      postingId: postingId,
    })

    expect(result).toBeInstanceOf(CareerPosting)
  })
})

describe("UpdateCareerPosting", () => {
  test("admin updates a posting's content and status", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: postingId,
      title: "Senior Platform Engineer",
      deptId: 3,
      deptName: "Engineering",
      requiredSkills: "typescript,go",
      status: "closed",
    })

    expect(updated).toBeInstanceOf(CareerPosting)

    if (updated instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(updated.title).toBe("Senior Platform Engineer")
    expect(updated.status).toBe("closed")
  })

  test("returns posting_not_found for a missing id", async () => {
    const { context } = createTestContext()

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: 9999,
      title: "X",
      deptId: null,
      deptName: null,
      requiredSkills: null,
      status: "open",
    })

    expectApplicationError(updated, NotFoundError, "posting_not_found")
  })
})

describe("DeleteCareerPosting", () => {
  test("admin deletes a posting", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: postingId,
    })

    if (result instanceof ApplicationError) {
      throw new Error("delete failed")
    }

    expect(result.reason).toBe("deleted")

    const afterDelete = await new GetCareerPosting(context).run({
      postingId: postingId,
    })

    expectApplicationError(afterDelete, NotFoundError, "posting_not_found")
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("member"),
      postingId: postingId,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns has_applied_applications when the posting has applied applications", async () => {
    const { context } = createTestContext()

    const postingId = await seedPosting(context)

    // Apply to the posting so it has a pending application
    const applied = await new ApplyToCareerPosting(context).run({
      postingId,
      applicantId: 10,
      message: null,
    })

    if (applied instanceof ApplicationError) {
      throw new Error("apply failed")
    }

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId,
    })

    expectApplicationError(result, ConflictError, "has_applied_applications")
  })

  test("deletes rejected applications atomically when deleting a posting", async () => {
    const { context, db } = createTestContext()

    const postingId = await seedPosting(context)

    // Seed a rejected application directly (no use case sets status=rejected on career_applications)
    await db
      .prepare(
        "INSERT INTO career_applications (posting_id, applicant_id, message, status) VALUES (?1, ?2, NULL, 'rejected')",
      )
      .bind(postingId, 10)
      .run()

    // Now delete the posting — should succeed (no applied applications)
    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId,
    })

    if (result instanceof ApplicationError) {
      throw new Error("unexpected error")
    }

    expect(result.reason).toBe("deleted")

    // Verify the rejected application was also deleted (no orphan records)
    const applicationRepository = new CareerApplicationRepository(context)
    const count = await applicationRepository.countByPostingIdAndStatus(postingId, "rejected")

    expect(count).toBe(0)
  })
})
