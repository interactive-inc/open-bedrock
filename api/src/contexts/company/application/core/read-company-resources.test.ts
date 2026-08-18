import { describe, expect, test } from "bun:test"
import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import { readCompanyResources } from "@/contexts/company/application/core/read-company-resources"

const actor: CompanyActor = {
  accountId: "account:1",
  employeeId: "employee:1",
  organizationIds: ["organization:default"],
  capabilities: ["company:read", "company:write"],
}

describe("readCompanyResources", () => {
  test("actorのorganization外をfail closedで拒否する", async () => {
    const result = await readCompanyResources(
      actor,
      { organizationId: "organization:other", types: ["employee"] },
      async () => ({ ok: true, organizationRevision: 0, resources: [] }),
    )

    expect(result).toEqual({ kind: "forbidden" })
  })

  test("不正なas-of queryをpersistence到達前に拒否する", async () => {
    let readCount = 0
    const result = await readCompanyResources(
      actor,
      {
        organizationId: "organization:default",
        types: ["employee"],
        effectiveOn: "2026-02-30" as never,
      },
      async () => {
        readCount += 1
        return { ok: true, organizationRevision: 0, resources: [] }
      },
    )

    expect(result).toMatchObject({ kind: "invalid", error: { code: "invalid_query" } })
    expect(readCount).toBe(0)
  })
})
