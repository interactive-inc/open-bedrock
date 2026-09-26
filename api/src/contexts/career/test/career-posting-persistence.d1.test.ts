import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { testOrganizationUnitId } from "@tests/api/support/company/test-organization-unit-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { CareerApplication } from "@/contexts/career/domain/entities/career-application.entity"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import { CareerOrganizationUnitAdapter } from "@/contexts/career/infrastructure/adapters/career-organization-unit.adapter"
import { CareerApplicationRepository } from "@/contexts/career/infrastructure/repositories/career-application.repository"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"
import type { Context } from "@/env"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { COMPANY_ROOT_ORGANIZATION_UNIT_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["organization", "delete"] })
})

afterAll(async () => {
  await local.dispose()
})

async function createPosting(context: Context): Promise<CareerPosting> {
  const created = await new CareerPostingRepository(context).create(
    CareerPosting.create({
      title: "Platform Engineer",
      organizationUnitId: testOrganizationUnitId("D003"),
      requiredSkills: "typescript",
      status: "open",
    }),
  )

  if (created instanceof Error) throw created

  return created
}

describe("career posting persistence on local D1", () => {
  test("resolves selectable organization units from the company organization", async () => {
    const { context } = await createLocalD1Context(local, "organization", {
      withCompanyOrganization: true,
    })

    const units = await new CareerOrganizationUnitAdapter(context).load()

    if (units instanceof Error) throw units

    expect(units.isSelectable(testOrganizationUnitId("D003"))).toBe(true)
    expect(units.isSelectable(testOrganizationUnitId("D999"))).toBe(false)
    expect(
      units.isSelectable(
        restoreWorkforceId("organization_unit", COMPANY_ROOT_ORGANIZATION_UNIT_ID),
      ),
    ).toBe(false)

    const posting = await createPosting(context)

    expect(posting.id).not.toBe(null)
    expect(posting.organizationUnitId).toBe(testOrganizationUnitId("D003"))
    expect(posting.legacyDeptName).toBeNull()
  })

  test("keeps a posting with applied applications and deletes rejected ones with the posting", async () => {
    const { context, db } = await createLocalD1Context(local, "delete", {
      withCompanyOrganization: true,
    })

    const postingRepository = new CareerPostingRepository(context)

    const applicationRepository = new CareerApplicationRepository(context)

    const withApplied = await createPosting(context)

    const applied = await applicationRepository.create(
      CareerApplication.create({
        postingId: withApplied.id ?? "",
        applicantId: toWorkforceEmployeeId(10),
        message: null,
      }),
    )

    expect(applied).toBeInstanceOf(CareerApplication)
    expect(await postingRepository.deleteIfNoAppliedApplications(withApplied)).toBe(null)
    expect(await postingRepository.findById(withApplied.id ?? "")).toBeInstanceOf(CareerPosting)

    const withRejected = await createPosting(context)

    await db
      .prepare(
        "INSERT INTO career_applications (id, posting_id, applicant_id, message, status) VALUES (?3, ?1, ?2, NULL, 'rejected')",
      )
      .bind(withRejected.id, "10", crypto.randomUUID())
      .run()

    expect(await postingRepository.deleteIfNoAppliedApplications(withRejected)).toBe(true)
    expect(await postingRepository.findById(withRejected.id ?? "")).toBe(null)
    expect(
      await applicationRepository.countByPostingIdAndStatus(withRejected.id ?? "", "rejected"),
    ).toBe(0)
  })
})
