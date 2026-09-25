import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { toWorkforceOrganizationUnitId } from "@/contexts/company/domain/definitions/to-workforce-organization-unit-id.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"
import { ApplyToCareerPosting } from "@/contexts/career/application/apply-to-career-posting"
import { CreateCareerPosting } from "@/contexts/career/application/create-career-posting"
import { DeleteCareerPosting } from "@/contexts/career/application/delete-career-posting"
import { UpdateCareerPosting } from "@/contexts/career/application/update-career-posting"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"

/**
 * 公募・応募Repositoryと募集部署Adapterの型付きfake。SQLは模倣せず、保存したDomain modelを返す。
 * 募集部署として選べる組織単位は標準の会社組織に合わせてD003だけにする。
 * 採番、条件付き削除、会社組織からの解決はlocal D1の career-posting-persistence.d1.test.ts で検証する。
 */
function createContext() {
  const postings = new Map<string, CareerPosting>()
  const applications: CareerApplication[] = []
  const selectable = new Set<OrganizationUnitId>([toWorkforceOrganizationUnitId("D003")])

  const postingRepository = {
    findById: async (id: string) => postings.get(id) ?? null,
    create: async (careerPosting: CareerPosting) => {
      const id = crypto.randomUUID()
      const saved = new CareerPosting({
        id,
        title: careerPosting.title,
        organizationUnitId: careerPosting.organizationUnitId,
        legacyDeptName: careerPosting.legacyDeptName,
        requiredSkills: careerPosting.requiredSkills,
        status: careerPosting.status,
      })
      postings.set(id, saved)
      return saved
    },
    update: async (careerPosting: CareerPosting) => {
      if (careerPosting.id === null || !postings.has(careerPosting.id)) return null
      postings.set(careerPosting.id, careerPosting)
      return careerPosting
    },
    deleteIfNoAppliedApplications: async (posting: CareerPosting) => {
      if (
        applications.some(
          (application) => application.postingId === posting.id && application.status === "applied",
        )
      )
        return null
      if (posting.id !== null) postings.delete(posting.id)
      return true as const
    },
  }

  const applicationRepository = {
    findByPostingAndApplicant: async (postingId: string, applicantId: EmployeeId) =>
      applications.find(
        (application) =>
          application.postingId === postingId && application.applicantId === applicantId,
      ) ?? null,
    create: async (careerApplication: CareerApplication) => {
      applications.push(careerApplication)
      return careerApplication
    },
  }

  const organizationUnits = {
    load: async () => ({
      isSelectable: (organizationUnitId: OrganizationUnitId) => selectable.has(organizationUnitId),
      nameOf: () => null,
    }),
  }

  return { postingRepository, applicationRepository, organizationUnits, postings }
}

async function seedPosting(context: ReturnType<typeof createContext>): Promise<string> {
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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

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
    const context = createContext()

    const updated = await new UpdateCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId: "01900017-0000-7000-8000-00000000270f",
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
    const context = createContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("member"),
      postingId: postingId,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns has_applied_applications when the posting has applied applications", async () => {
    const context = createContext()

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

  test("deletes the posting when it has no applied applications", async () => {
    const context = createContext()

    const postingId = await seedPosting(context)

    const result = await new DeleteCareerPosting(context).run({
      session: makeTestSession("root"),
      postingId,
    })

    if (result instanceof ApplicationError) {
      throw new Error("unexpected error")
    }

    expect(result.reason).toBe("deleted")
    expect(context.postings.has(postingId)).toBe(false)
  })
})
