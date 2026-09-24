import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Asset } from "@/contexts/asset/domain/entities/asset.entity"
import { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["update-details"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("AssetRepository on local D1", () => {
  test("updateDetails persists details, keeps status and returns null for an unknown code", async () => {
    const { context } = await createLocalD1Context(local, "update-details")

    const repository = new AssetRepository(context)

    const created = await repository.create(
      Asset.create({
        code: "A1001",
        name: "Notebook",
        kind: "pc",
        serial: "SN-1",
        purchasedOn: "2025-01-01",
      }),
    )

    if (created instanceof Error) throw created

    const updated = await repository.updateDetails(
      created.withDetails({
        name: "Renamed",
        kind: "monitor",
        serial: "SN-2",
        purchasedOn: "2026-02-02",
      }),
    )

    expect(updated).toBeInstanceOf(Asset)

    const found = await repository.findByCode("A1001")

    if (found === null || found instanceof Error) throw new Error("asset not persisted")

    expect(found.name).toBe("Renamed")
    expect(found.kind).toBe("monitor")
    expect(found.serial).toBe("SN-2")
    expect(found.purchasedOn).toBe("2026-02-02")
    expect(found.status).toBe("in_stock")

    const missing = await repository.updateDetails(
      Asset.create({ code: "A9999", name: "Ghost", kind: "pc", serial: null, purchasedOn: null }),
    )

    expect(missing).toBe(null)
  })
})
