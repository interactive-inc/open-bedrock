import { Asset } from "@/contexts/asset/domain/asset.entity"
import { DeleteAsset } from "@/contexts/asset/application/delete-asset"
import { UpdateAsset } from "@/contexts/asset/application/update-asset"
import { AssetRepository } from "@/contexts/asset/infrastructure/asset.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { describe, expect, test } from "bun:test"
import type { Context } from "@/env"

async function seedInStock(context: Context, code: string): Promise<void> {
  const repository = new AssetRepository(context)

  const created = await repository.create(
    Asset.create({
      code: code,
      name: "Notebook",
      kind: "pc",
      serial: "SN-1",
      purchasedOn: "2025-01-01",
    }),
  )

  if (created instanceof Error) {
    throw new Error("seed failed")
  }
}

async function seedLent(context: Context, code: string): Promise<void> {
  const repository = new AssetRepository(context)

  await seedInStock(context, code)

  const lent = await repository.lendFromStock({
    assetCode: code,
    employeeId: 5,
    lentAt: "2026-01-01T00:00:00.000Z",
  })

  if (lent instanceof Error || lent === null) {
    throw new Error("seed lent failed")
  }
}

describe("UpdateAsset", () => {
  test("updates details for a privileged role", async () => {
    const { context } = createTestContext()

    await seedInStock(context, "A1001")

    const result = await new UpdateAsset(context).run({
      session: makeTestSession("root"),
      code: "A1001",
      details: { name: "Renamed", kind: "monitor", serial: "SN-2", purchasedOn: "2026-02-02" },
    })

    expect(result).toBeInstanceOf(Asset)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Renamed")
    expect(result.kind).toBe("monitor")
    expect(result.serial).toBe("SN-2")
    expect(result.status).toBe("in_stock")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const { context } = createTestContext()

    await seedInStock(context, "A1002")

    const result = await new UpdateAsset(context).run({
      session: makeTestSession("member"),
      code: "A1002",
      details: { name: "Renamed", kind: "pc", serial: null, purchasedOn: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with asset_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateAsset(context).run({
      session: makeTestSession("root"),
      code: "A9999",
      details: { name: "Ghost", kind: "pc", serial: null, purchasedOn: null },
    })

    expectApplicationError(result, NotFoundError, "asset_not_found")
  })
})

describe("DeleteAsset", () => {
  test("deletes an in_stock asset for a privileged role", async () => {
    const { context } = createTestContext()

    await seedInStock(context, "A1003")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A1003",
    })

    expect(result).toEqual({ reason: "deleted" })

    const repository = new AssetRepository(context)

    const found = await repository.findByCode("A1003")

    expect(found).toBeNull()
  })

  test("rejects a lent asset with asset_in_use", async () => {
    const { context } = createTestContext()

    await seedLent(context, "A1004")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A1004",
    })

    expectApplicationError(result, ConflictError, "asset_in_use")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const { context } = createTestContext()

    await seedInStock(context, "A1005")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("member"),
      code: "A1005",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with asset_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A9999",
    })

    expectApplicationError(result, NotFoundError, "asset_not_found")
  })
})
