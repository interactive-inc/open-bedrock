import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { ApplyToCareerPosting } from "@/contexts/career/application/apply-to-career-posting"
import { CreateCareerPosting } from "@/contexts/career/application/create-career-posting"
import { DeleteCareerPosting } from "@/contexts/career/application/delete-career-posting"
import { UpdateCareerPosting } from "@/contexts/career/application/update-career-posting"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/repositories/career-application.repository"
import type { Context } from "@/env"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { createTestContext } from "@tests/api/support/create-test-context"
import { makeTestSession } from "@tests/api/support/make-test-session"

async function seedPosting(context: Context): Promise<number> {
  const created = await new CreateCareerPosting(context).run({
    session: makeTestSession("root"),
    title: "Platform Engineer",
    organizationUnitId: toWorkforceOrganizationUnitId("D003"),
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
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("hr"),
      title: "Data Analyst",
      organizationUnitId: null,
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
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("member"),
      title: "X",
      organizationUnitId: null,
      requiredSkills: null,
      status: "open",
    })

    expect(created instanceof CareerPosting).toBe(false)

    expectApplicationError(created, ForbiddenError, "forbidden")
  })

  test("stores the selected organization unit", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("root"),
      title: "Data Analyst",
      organizationUnitId: toWorkforceOrganizationUnitId("D003"),
      requiredSkills: null,
      status: "open",
    })

    if (created instanceof ApplicationError) {
      throw new Error("create failed")
    }

    expect(created.organizationUnitId).toBe(toWorkforceOrganizationUnitId("D003"))
    expect(created.legacyDeptName).toBeNull()
  })

  test("rejects an organization unit that does not exist", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("root"),
      title: "Data Analyst",
      organizationUnitId: toWorkforceOrganizationUnitId("D999"),
      requiredSkills: null,
      status: "open",
    })

    expectApplicationError(created, UnprocessableError, "organization_unit_not_selectable")
  })

  test("rejects the company itself as a posting department", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const created = await new CreateCareerPosting(context).run({
      session: makeTestSession("root"),
      title: "Data Analyst",
      organizationUnitId: restoreWorkforceId("organization_unit", "company:root"),
      requiredSkills: null,
      status: "open",
    })

    expectApplicationError(created, UnprocessableError, "organization_unit_not_selectable")
  })
})

describe("GetCareerPosting", () => {})

describe("UpdateCareerPosting", () => {
  test("admin updates a posting's content and status", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const postingId = await seedPosting(context)

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: postingId,
      title: "Senior Platform Engineer",
      organizationUnitId: toWorkforceOrganizationUnitId("D003"),
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

  test("rejects moving a posting to an unknown organization unit", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const postingId = await seedPosting(context)

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: postingId,
      title: "Senior Platform Engineer",
      organizationUnitId: toWorkforceOrganizationUnitId("D999"),
      requiredSkills: null,
      status: "open",
    })

    expectApplicationError(updated, UnprocessableError, "organization_unit_not_selectable")
  })

  test("returns posting_not_found for a missing id", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: 9999,
      title: "X",
      organizationUnitId: null,
      requiredSkills: null,
      status: "open",
    })

    expectApplicationError(updated, NotFoundError, "posting_not_found")
  })
})

describe("DeleteCareerPosting", () => {
  test("a non-privileged role is forbidden", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("member"),
      postingId: postingId,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns has_applied_applications when the posting has applied applications", async () => {
    const { context } = await createTestContext({ withCompanyOrganization: true })

    const postingId = await seedPosting(context)

    // Apply to the posting so it has a pending application
    const applied = await new ApplyToCareerPosting(context).run({
      postingId,
      applicantId: toWorkforceEmployeeId(10),
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
    const { context, db } = await createTestContext({ withCompanyOrganization: true })

    const postingId = await seedPosting(context)

    // Seed a rejected application directly (no service sets status=rejected on career_applications)
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
