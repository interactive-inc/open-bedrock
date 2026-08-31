import { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"
import { describe, expect, test } from "bun:test"

const now = new Date("2026-08-31T00:00:00.000Z")

describe("SystemPrincipalEntity", () => {
  test("Human・Agent・Service・ConnectorをAccountから独立した主体種別として復元する", () => {
    for (const kind of ["human", "agent", "service"] as const) {
      expect(
        SystemPrincipalEntity.create({
          id: `principal:${kind}`,
          accountId: `account:${kind}`,
          kind,
          name: kind,
          connectorId: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
      ).toBeInstanceOf(SystemPrincipalEntity)
    }
    expect(
      SystemPrincipalEntity.create({
        id: "principal:connector",
        accountId: "account:connector",
        kind: "connector",
        name: "Connector",
        connectorId: "connector:external",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeInstanceOf(SystemPrincipalEntity)
  })

  test("ConnectorだけにConnector参照を要求する", () => {
    expect(
      SystemPrincipalEntity.create({
        id: "principal:connector",
        accountId: "account:connector",
        kind: "connector",
        name: "Connector",
        connectorId: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual(expect.objectContaining({ reason: "invalid_subject" }))
  })
})
