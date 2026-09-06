import { expect, test } from "bun:test"
import { UpdateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

test("別organizationへのプロフィール変更を保存前に拒否する", async () => {
  const writes: string[] = []
  const update = new UpdateOrganizationProfile({
    actor: CompanyActorValue.restore({
      accountId: "account:operator",
      employeeId: null,
      organizationIds: ["organization:other"],
      capabilities: ["company:admin"],
    }),
    organizationId: "organization:default",
    repository: {
      find: async () => null,
      save: async (organizationId) => {
        writes.push(organizationId)
      },
    },
  })
  expect(
    await update.execute({ name: "Company", representativeName: "Representative" }),
  ).toBeInstanceOf(CompanyForbiddenError)
  expect(writes).toEqual([])
})
