import { InvalidCompanyActorError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { describe, expect, test } from "bun:test"

describe("CompanyActorValue", () => {
  test("owns organization scope and capability checks", () => {
    const actor = CompanyActorValue.restore({
      accountId: "account:1",
      employeeId: "employee:1",
      organizationIds: ["organization:1"],
      capabilities: ["company:read"],
    })

    expect(actor.canAccessOrganization("organization:1")).toBe(true)
    expect(actor.canAccessOrganization("organization:2")).toBe(false)
    expect(actor.hasCapability("company:read")).toBe(true)
    expect(actor.hasCapability("company:write")).toBe(false)
    expect(Object.isFrozen(actor)).toBe(true)
    expect(Object.isFrozen(actor.organizationIds)).toBe(true)
  })

  test("company administrator satisfies every Company capability", () => {
    const actor = CompanyActorValue.restore({
      accountId: "account:1",
      employeeId: null,
      organizationIds: ["*"],
      capabilities: ["company:admin"],
    })

    expect(actor.canAccessOrganization("organization:any")).toBe(true)
    expect(actor.hasCapability("company:read")).toBe(true)
    expect(actor.hasCapability("company:write")).toBe(true)
  })

  test("rejects ambiguous or duplicated actor claims", () => {
    expect(() =>
      CompanyActorValue.restore({
        accountId: "account:1",
        employeeId: null,
        organizationIds: ["organization:1", "organization:1"],
        capabilities: ["company:read"],
      }),
    ).toThrow(InvalidCompanyActorError)
  })
})
