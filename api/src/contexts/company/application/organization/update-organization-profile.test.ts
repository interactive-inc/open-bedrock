import { expect, spyOn, test } from "bun:test"
import { UpdateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { OrganizationProfileChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-profile-change.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

test("別organizationへのプロフィール変更を保存前に拒否する", async () => {
  const repository = new OrganizationProfileChangeRepository(
    createCompanyD1TestDatabase("SELECT 1;"),
  )
  const write = spyOn(OrganizationProfileChangeRepository.prototype, "change")
  const update = new UpdateOrganizationProfile({
    actor: CompanyActorValue.restore({
      accountId: "account:operator",
      employeeId: null,
      organizationIds: ["organization:other"],
      capabilities: ["company:admin"],
    }),
    repository,
    now: new Date("2026-09-07T03:00:00.000Z"),
    timeZone: "Asia/Tokyo",
  })
  try {
    expect(
      await update.execute({
        commandId: "profile:scope",
        name: "Company",
        representativeName: "Representative",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        fiscalYearStartMonth: 4,
        version: {
          organizationId: "organization:default",
          organizationRevision: 0,
          resourceId: null,
          resourceRevision: 0,
          effectiveOn: "2026-09-07",
          effectiveTo: null,
          sourceFingerprint: "0".repeat(64),
        },
        reason: "Confirmed profile",
      }),
    ).toBeInstanceOf(CompanyForbiddenError)
    expect(write).not.toHaveBeenCalled()
  } finally {
    write.mockRestore()
  }
})
