import { Asset } from "@/domain/asset/asset"
import { AssetLending } from "@/domain/asset/asset-lending"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("AssetRepository", () => {
  test("create then findByCode round-trips the asset", async () => {
    const { context } = createTestContext()

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

  test("update persists the lend status change", async () => {
    const { context } = createTestContext()

    const repository = new AssetRepository(context)

    const created = await repository.create(
      Asset.create({
        code: "PC-002",
        name: "ノートPC",
        kind: "laptop",
        serial: null,
        purchasedOn: null,
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(created.withLendStatus("lent", 1))

    expect(updated).toBeInstanceOf(Asset)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("lent")
    expect(updated.holderEmployeeId).toBe(1)
  })

  test("addLending persists an open lending for the asset", async () => {
    const { context } = createTestContext()

    const repository = new AssetRepository(context)

    const created = await repository.addLending(
      AssetLending.create({
        assetCode: "PC-001",
        employeeId: 1,
        lentAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(AssetLending)

    if (created instanceof Error || created.id === null) {
      throw new Error("addLending failed")
    }

    expect(created.assetCode).toBe("PC-001")
    expect(created.returnedAt).toBeNull()
  })

  test("closeLending sets returnedAt on the open lending", async () => {
    const { context } = createTestContext()

    const repository = new AssetRepository(context)

    const created = await repository.addLending(
      AssetLending.create({
        assetCode: "PC-003",
        employeeId: 1,
        lentAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const closed = await repository.closeLending("PC-003", "2026-02-01T00:00:00.000Z")

    expect(closed).toBeInstanceOf(AssetLending)

    if (closed instanceof Error || closed === null) {
      throw new Error("closeLending failed")
    }

    expect(closed.returnedAt).toBe("2026-02-01T00:00:00.000Z")
  })
})
