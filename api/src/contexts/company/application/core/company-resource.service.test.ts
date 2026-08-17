import { describe, expect, test } from "bun:test"
import { CompanyResourceService, type CompanyActor } from "./company-resource.service"
import type { CompanyResourceRepository } from "./company-resource.repository"

const actor: CompanyActor = {
  accountId: "account:1",
  employeeId: "employee:1",
  organizationIds: ["organization:default"],
  capabilities: ["company:read", "company:write"],
}

describe("CompanyResourceService", () => {
  test("actorのorganization外をfail closedで拒否する", async () => {
    const repository: CompanyResourceRepository = {
      read: async () => ({ ok: true, organizationRevision: 0, resources: [] }),
      write: async () => ({ kind: "applied", organizationRevision: 1, replayed: false }),
    }
    const result = await new CompanyResourceService(repository).read(actor, {
      organizationId: "organization:other",
      types: ["employee"],
    })

    expect(result).toEqual({ kind: "forbidden" })
  })

  test("不正なas-of queryをrepository到達前に拒否する", async () => {
    let readCount = 0
    const repository: CompanyResourceRepository = {
      read: async () => {
        readCount += 1
        return { ok: true, organizationRevision: 0, resources: [] }
      },
      write: async () => ({ kind: "applied", organizationRevision: 1, replayed: false }),
    }
    const result = await new CompanyResourceService(repository).read(actor, {
      organizationId: "organization:default",
      types: ["employee"],
      effectiveOn: "2026-02-30" as never,
    })

    expect(result).toMatchObject({ kind: "invalid", error: { code: "invalid_query" } })
    expect(readCount).toBe(0)
  })
})
