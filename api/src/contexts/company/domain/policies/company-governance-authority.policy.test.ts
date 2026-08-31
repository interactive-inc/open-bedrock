import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyGovernanceAuthorityError } from "@/contexts/company/domain/errors"
import { resolveCompanyGovernanceAuthority } from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-01-01")

describe("Company governance authority", () => {
  test("金額scopeと合議体を評価し、在籍・Account・自己除外を満たす候補へ固定する", () => {
    const resources = [
      resource("responsibility", "responsibility:approve", {
        code: "APPROVE",
        officialName: "Approval",
      }),
      resource("authority-scope", "scope:amount", {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1_000,
      }),
      resource("collective-body", "body:committee", {
        code: "COMMITTEE",
        officialName: "Committee",
        quorumType: "count",
        quorumValue: 2,
        decisionRule: "majority",
      }),
      resource("responsibility-assignment", "responsibility-assignment:1", {
        responsibilityId: "responsibility:approve",
        holderType: "collective-body",
        holderId: "body:committee",
        authorityScopeId: "scope:amount",
        delegationAllowed: false,
      }),
      ...["1", "2", "3"].flatMap((suffix) => [
        resource("person", `person:${suffix}`, { officialName: `Person ${suffix}` }),
        resource("employee", `employee:${suffix}`, {
          personId: `person:${suffix}`,
          employeeCode: `E${suffix}`,
        }),
        resource("employment", `employment:${suffix}`, {
          employeeId: `employee:${suffix}`,
          status: "ACTIVE",
        }),
        resource("account-employee-link", `link:${suffix}`, {
          accountId: `account:${suffix}`,
          employeeId: `employee:${suffix}`,
        }),
        resource("collective-body-membership", `membership:${suffix}`, {
          collectiveBodyId: "body:committee",
          employeeId: `employee:${suffix}`,
          role: suffix === "1" ? "chair" : "member",
          voting: true,
        }),
      ]),
    ]
    const resolution = resolveCompanyGovernanceAuthority({
      asOf,
      organizationRevision: 7,
      subjectEmployeeId: "employee:1",
      criteria: [
        {
          responsibilityCode: "APPROVE",
          scope: { scopeType: "amount", currencyCode: "JPY", amount: 500 },
        },
      ],
      resources,
      activeAccountIds: new Set(["account:1", "account:2", "account:3"]),
    })

    expect(resolution).not.toBeInstanceOf(CompanyGovernanceAuthorityError)
    if (resolution instanceof CompanyGovernanceAuthorityError) return
    expect(resolution.snapshot).toEqual({
      schemaVersion: 1,
      source: "company-resource",
      asOf,
      organizationRevision: 7,
    })
    expect(resolution.candidates.map((candidate) => candidate.accountId)).toEqual([
      "account:2",
      "account:3",
    ])
    expect(resolution.exclusions).toEqual([
      { employeeId: "employee:1", accountId: "account:1", reason: "subject" },
    ])
    expect(resolution.candidates[0]?.qualifications[0]?.collectiveDecision).toEqual({
      collectiveBodyId: "body:committee",
      votingMemberCount: 3,
      quorumRequired: 2,
      approvalRequired: 2,
      decisionRule: "majority",
    })
  })

  test("scope外は候補ゼロ、構成員より大きい定足数はfail closedにする", () => {
    const common = [
      resource("responsibility", "responsibility:approve", {
        code: "APPROVE",
        officialName: "Approval",
      }),
      resource("authority-scope", "scope:region", {
        scopeType: "region",
        regionCode: "EAST",
      }),
      resource("employee", "employee:1", { personId: "person:1", employeeCode: "E1" }),
      resource("employment", "employment:1", {
        employeeId: "employee:1",
        status: "ACTIVE",
      }),
      resource("account-employee-link", "link:1", {
        accountId: "account:1",
        employeeId: "employee:1",
      }),
    ]
    const outOfScope = resolveCompanyGovernanceAuthority({
      asOf,
      organizationRevision: 1,
      subjectEmployeeId: null,
      criteria: [
        {
          responsibilityCode: "APPROVE",
          scope: { scopeType: "region", regionCode: "WEST" },
        },
      ],
      resources: [
        ...common,
        resource("responsibility-assignment", "assignment:1", {
          responsibilityId: "responsibility:approve",
          holderType: "employee",
          holderId: "employee:1",
          authorityScopeId: "scope:region",
          delegationAllowed: false,
        }),
      ],
      activeAccountIds: new Set(["account:1"]),
    })
    expect(outOfScope).toMatchObject({ candidates: [] })

    const invalidBody = resolveCompanyGovernanceAuthority({
      asOf,
      organizationRevision: 1,
      subjectEmployeeId: null,
      criteria: [{ responsibilityCode: "APPROVE", scope: null }],
      resources: [
        ...common,
        resource("collective-body", "body:1", {
          code: "BODY",
          officialName: "Body",
          quorumType: "count",
          quorumValue: 2,
          decisionRule: "majority",
        }),
        resource("collective-body-membership", "membership:1", {
          collectiveBodyId: "body:1",
          employeeId: "employee:1",
          role: "chair",
          voting: true,
        }),
        resource("responsibility-assignment", "assignment:2", {
          responsibilityId: "responsibility:approve",
          holderType: "collective-body",
          holderId: "body:1",
          authorityScopeId: null,
          delegationAllowed: false,
        }),
      ],
      activeAccountIds: new Set(["account:1"]),
    })
    expect(invalidBody).toBeInstanceOf(CompanyGovernanceAuthorityError)
  })

  test("scopeが参照する対象resourceを同じsnapshotで確認できなければ拒否する", () => {
    const resolution = resolveCompanyGovernanceAuthority({
      asOf,
      organizationRevision: 1,
      subjectEmployeeId: null,
      criteria: [
        {
          responsibilityCode: "APPROVE",
          scope: { scopeType: "legal-entity", scopeId: "legal-entity:missing" },
        },
      ],
      resources: [
        resource("responsibility", "responsibility:approve", {
          code: "APPROVE",
          officialName: "Approval",
        }),
        resource("authority-scope", "scope:legal-entity", {
          scopeType: "legal-entity",
          scopeId: "legal-entity:missing",
        }),
        resource("responsibility-assignment", "assignment:1", {
          responsibilityId: "responsibility:approve",
          holderType: "employee",
          holderId: "employee:1",
          authorityScopeId: "scope:legal-entity",
          delegationAllowed: false,
        }),
      ],
      activeAccountIds: new Set(),
    })
    expect(resolution).toMatchObject({ code: "governance_authority_reference_missing" })
  })
})

function resource(
  type: Parameters<typeof CompanyResourceEntity.create>[0]["type"],
  id: string,
  attributes: Parameters<typeof CompanyResourceEntity.create>[0]["attributes"],
): CompanyResourceEntity {
  const value = CompanyResourceEntity.create({
    organizationId: "organization:1",
    type,
    id,
    revision: 1,
    state: "active",
    effectiveFrom: asOf,
    effectiveTo: null,
    attributes,
  })
  if (value instanceof Error) throw value
  return value
}
