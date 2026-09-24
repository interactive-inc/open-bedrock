import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["partner"] })
})

afterAll(async () => {
  await local.dispose()
})

function newPartner(code: string, name: string): Partner {
  return Partner.create({
    code,
    name,
    category: "supplier",
    corporateNumber: null,
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

describe("PartnerRepository on local D1", () => {
  test("assigns an id, rejects a duplicate code and persists updates and archive", async () => {
    const { context, db } = await createLocalD1Context(local, "partner")

    const repository = new PartnerRepository(context)

    const created = await repository.create(newPartner("P0001", "Acme Supplies"))

    if (created instanceof Error) throw created

    expect(created.id).not.toBeNull()
    expect(created.status).toBe("active")

    const duplicate = await repository.create(newPartner("P0001", "Another Partner"))

    expect(duplicate).toBeInstanceOf(UniqueConstraintError)

    const updated = await repository.update(
      created.withDetails({
        name: "Renamed Partner",
        category: "customer",
        corporateNumber: "9999999999999",
        note: "updated",
      }),
    )

    if (updated instanceof Error || updated === null) throw new Error("update failed")

    expect(updated.name).toBe("Renamed Partner")

    const archived = await repository.update(updated.archive())

    expect(archived instanceof Partner ? archived.status : archived).toBe("archived")

    const rows = await db
      .prepare("SELECT code, name, category, corporate_number, status FROM partners")
      .all<Record<string, unknown>>()

    expect(rows.results).toEqual([
      {
        code: "P0001",
        name: "Renamed Partner",
        category: "customer",
        corporate_number: "9999999999999",
        status: "archived",
      },
    ])

    const missing = await repository.update(
      Partner.create({
        code: "P9999",
        name: "Missing",
        category: null,
        corporateNumber: null,
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(missing).toBeInstanceOf(Error)
    expect(await repository.findById(9999)).toBeNull()
  })
})
