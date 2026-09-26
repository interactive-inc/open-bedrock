import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { Asset } from "@/contexts/asset/domain/entities/asset.entity"
import { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { assetLendings } from "@/contexts/asset/infrastructure/schema/asset"
import type { Context } from "@/env"
import { eq } from "drizzle-orm"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "update-details",
      "create-then-findbycode-round-trips-the-asset",
      "lendfromstock-lends-an-in-stock-asset-and",
      "lendfromstock-returns-null-for-an-already-lent",
      "returnfromlent-returns-the-asset-to-stock-and",
      "returnfromlent-returns-null-for-an-asset-that",
      "deleteifnotlent-deletes-the-asset-and-its",
      "deleteifnotlent-returns-null-for-a-lent-asset",
    ],
  })
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

async function seedInStock(context: Context, code: string): Promise<void> {
  const repository = new AssetRepository(context)

  const created = await repository.create(
    Asset.create({
      code: code,
      name: "ノートPC",
      kind: "laptop",
      serial: null,
      purchasedOn: null,
    }),
  )

  if (created instanceof Error) {
    throw created
  }
}

describe("AssetRepository", () => {
  test("create then findByCode round-trips the asset", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbycode-round-trips-the-asset",
    )

    const repository = new AssetRepository(context)

    const created = await repository.create(
      Asset.create({
        code: "PC-001",
        name: "ノートPC",
        kind: "laptop",
        serial: "SN-12345",
        purchasedOn: "2026-01-01",
      }),
    )

    expect(created).toBeInstanceOf(Asset)

    if (created instanceof Error) {
      throw created
    }

    const found = await repository.findByCode("PC-001")

    expect(found).toBeInstanceOf(Asset)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.name).toBe("ノートPC")
    expect(found.status).toBe("in_stock")
  })

  test("lendFromStock lends an in_stock asset and opens a lending atomically", async () => {
    const { context } = await createLocalD1Context(
      local,
      "lendfromstock-lends-an-in-stock-asset-and",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-002")

    const lent = await repository.lendFromStock({
      assetCode: "PC-002",
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      lentAt: "2026-01-01T00:00:00.000Z",
    })

    expect(lent).toBeInstanceOf(Asset)

    if (lent instanceof Error || lent === null) {
      throw new Error("lendFromStock failed")
    }

    expect(lent.status).toBe("lent")
    expect(lent.holderEmployeeId).toBe(toWorkforceEmployeeId(testEmployeeId(1)))

    const lendings = await context.var.database
      .select()
      .from(assetLendings)
      .where(eq(assetLendings.assetCode, "PC-002"))

    expect(lendings.length).toBe(1)
    expect(lendings.at(0)?.returnedAt).toBeNull()
  })

  test("lendFromStock returns null for an already lent asset and adds no lending", async () => {
    const { context } = await createLocalD1Context(
      local,
      "lendfromstock-returns-null-for-an-already-lent",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-003")

    await repository.lendFromStock({
      assetCode: "PC-003",
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      lentAt: "2026-01-01T00:00:00.000Z",
    })

    const second = await repository.lendFromStock({
      assetCode: "PC-003",
      employeeId: toWorkforceEmployeeId(testEmployeeId(2)),
      lentAt: "2026-01-02T00:00:00.000Z",
    })

    expect(second).toBeNull()

    const lendings = await context.var.database
      .select()
      .from(assetLendings)
      .where(eq(assetLendings.assetCode, "PC-003"))

    expect(lendings.length).toBe(1)

    const found = await repository.findByCode("PC-003")

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.holderEmployeeId).toBe(toWorkforceEmployeeId(testEmployeeId(1)))
  })

  test("returnFromLent returns the asset to stock and closes the open lending", async () => {
    const { context } = await createLocalD1Context(
      local,
      "returnfromlent-returns-the-asset-to-stock-and",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-004")

    await repository.lendFromStock({
      assetCode: "PC-004",
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      lentAt: "2026-01-01T00:00:00.000Z",
    })

    const returned = await repository.returnFromLent({
      assetCode: "PC-004",
      returnedAt: "2026-02-01T00:00:00.000Z",
    })

    expect(returned).toBeInstanceOf(Asset)

    if (returned instanceof Error || returned === null) {
      throw new Error("returnFromLent failed")
    }

    expect(returned.status).toBe("in_stock")
    expect(returned.holderEmployeeId).toBeNull()

    const lendings = await context.var.database
      .select()
      .from(assetLendings)
      .where(eq(assetLendings.assetCode, "PC-004"))

    expect(lendings.at(0)?.returnedAt).toBe("2026-02-01T00:00:00.000Z")
  })

  test("returnFromLent returns null for an asset that is not lent", async () => {
    const { context } = await createLocalD1Context(
      local,
      "returnfromlent-returns-null-for-an-asset-that",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-005")

    const returned = await repository.returnFromLent({
      assetCode: "PC-005",
      returnedAt: "2026-02-01T00:00:00.000Z",
    })

    expect(returned).toBeNull()
  })

  test("deleteIfNotLent deletes the asset and its lendings", async () => {
    const { context } = await createLocalD1Context(
      local,
      "deleteifnotlent-deletes-the-asset-and-its",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-006")

    await repository.lendFromStock({
      assetCode: "PC-006",
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      lentAt: "2026-01-01T00:00:00.000Z",
    })

    await repository.returnFromLent({
      assetCode: "PC-006",
      returnedAt: "2026-02-01T00:00:00.000Z",
    })

    const asset = await repository.findByCode("PC-006")
    if (asset instanceof Error || asset === null) throw new Error("asset should exist")
    const outcome = await repository.deleteIfNotLent(asset)

    expect(outcome).toBe("deleted")

    const found = await repository.findByCode("PC-006")

    expect(found).toBeNull()

    const lendings = await context.var.database
      .select()
      .from(assetLendings)
      .where(eq(assetLendings.assetCode, "PC-006"))

    expect(lendings.length).toBe(0)
  })

  test("deleteIfNotLent returns null for a lent asset and keeps it", async () => {
    const { context } = await createLocalD1Context(
      local,
      "deleteifnotlent-returns-null-for-a-lent-asset",
    )

    const repository = new AssetRepository(context)

    await seedInStock(context, "PC-007")

    await repository.lendFromStock({
      assetCode: "PC-007",
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
      lentAt: "2026-01-01T00:00:00.000Z",
    })

    const lentAsset = await repository.findByCode("PC-007")
    if (lentAsset instanceof Error || lentAsset === null) throw new Error("asset should exist")
    const outcome = await repository.deleteIfNotLent(lentAsset)

    expect(outcome).toBeNull()

    const found = await repository.findByCode("PC-007")

    if (found instanceof Error || found === null) {
      throw new Error("asset should remain")
    }

    expect(found.status).toBe("lent")

    const lendings = await context.var.database
      .select()
      .from(assetLendings)
      .where(eq(assetLendings.assetCode, "PC-007"))

    expect(lendings.length).toBe(1)
  })
})
