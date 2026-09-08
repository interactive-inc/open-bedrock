import { expect, test } from "bun:test"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import {
  CompanyResourceEntity,
  type CompanyJsonObject,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

const asOf = restoreCalendarDate("2030-01-01")
function resource(type: CompanyResourceEntity["type"], id: string, attributes: CompanyJsonObject) {
  const value = CompanyResourceEntity.create({
    organizationId: "organization:default",
    type,
    id,
    attributes,
    revision: 1,
    state: "active",
    effectiveFrom: asOf,
    effectiveTo: null,
  })
  if (value instanceof Error) throw value
  return value
}
function fixture() {
  const resources = [
    resource("responsibility", "responsibility:review", { code: "REVIEW", officialName: "Review" }),
    resource("responsibility-assignment", "responsibility-assignment:review", {
      responsibilityId: "responsibility:review",
      holderType: "employee",
      holderId: "employee:0",
      authorityScopeId: null,
      delegationAllowed: false,
    }),
    ...Array.from({ length: 1001 }, (_, index) => [
      resource("employee", `employee:${index}`, {
        personId: `person:${index}`,
        employeeCode: `E${index}`,
      }),
      resource("employment", `employment:${index}`, {
        employeeId: `employee:${index}`,
        status: "ACTIVE",
        employmentType: "FULL_TIME",
      }),
      resource("account-employee-link", `link:${index}`, {
        employeeId: `employee:${index}`,
        accountId: `account:${index}`,
      }),
    ]).flat(),
  ]
  return {
    repository: {
      findMany: async () => ({ ok: true as const, organizationRevision: 7, resources }),
    },
    input: {
      organizationId: "organization:default",
      asOf,
      subjectEmployeeId: null,
      criteria: [{ responsibilityCode: "REVIEW", scope: null }],
    },
  }
}

test("千人を超えるAccountの現在状態を一度に確認し、責務を持つ候補だけを返す", async () => {
  const f = fixture()
  let calls = 0
  const result = await new CompanyGovernanceAuthorityResolutionAdapter({
    repository: f.repository,
    readActiveAccountIds: async (ids) => {
      calls += 1
      expect(ids).toHaveLength(1001)
      expect(new Set(ids).size).toBe(1001)
      return new Set(ids)
    },
  }).resolve(f.input)
  expect(result).toMatchObject({
    kind: "resolved",
    resolution: { candidates: [{ employeeId: "employee:0", accountId: "account:0" }] },
  })
  expect(calls).toBe(1)
})

test.each(["unavailable", "unexpected", "inactive"])(
  "一括確認の失敗や対象外IDを管理者への補完で隠さない: %s",
  async (kind) => {
    const f = fixture()
    const result = await new CompanyGovernanceAuthorityResolutionAdapter({
      repository: f.repository,
      readActiveAccountIds: async (ids) => {
        if (kind === "unavailable") return new Error("Account read failed")
        if (kind === "unexpected") return new Set([...ids, "account:unexpected"])
        return new Set(ids.filter((id) => id !== "account:0"))
      },
    }).resolve(f.input)
    if (kind === "inactive")
      expect(result).toMatchObject({ kind: "resolved", resolution: { candidates: [] } })
    else expect(result.kind).toBe("unavailable")
  },
)
