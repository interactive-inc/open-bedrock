import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { Asset } from "@/contexts/asset/domain/entities/asset.entity"
import { DeleteAsset } from "@/contexts/asset/application/delete-asset"
import { UpdateAsset } from "@/contexts/asset/application/update-asset"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

/** 資産Repositoryの型付きfake。貸出中の削除拒否はRepositoryの条件付き削除に合わせてnullを返す。 */
function createContext() {
  const stored = new Map<string, Asset>()

  const assetRepository = {
    findByCode: async (code: string) => stored.get(code) ?? null,
    updateDetails: async (asset: Asset) => {
      if (!stored.has(asset.code)) return null
      stored.set(asset.code, asset)
      return asset
    },
    deleteIfNotLent: async (asset: Asset) => {
      if (stored.get(asset.code)?.status === "lent") return null
      stored.delete(asset.code)
      return "deleted" as const
    },
  }

  return { context: { assetRepository }, stored }
}

type FakeContext = ReturnType<typeof createContext>

function seedInStock(fake: FakeContext, code: string): void {
  fake.stored.set(
    code,
    Asset.create({
      code: code,
      name: "Notebook",
      kind: "pc",
      serial: "SN-1",
      purchasedOn: "2025-01-01",
    }),
  )
}

function seedLent(fake: FakeContext, code: string): void {
  seedInStock(fake, code)

  const inStock = fake.stored.get(code)

  if (inStock === undefined) throw new Error("seed lent failed")

  fake.stored.set(
    code,
    new Asset({
      code: inStock.code,
      name: inStock.name,
      kind: inStock.kind,
      serial: inStock.serial,
      purchasedOn: inStock.purchasedOn,
      status: "lent",
      holderEmployeeId: toWorkforceEmployeeId(5),
      disposedOn: null,
      disposalReason: null,
    }),
  )
}

describe("UpdateAsset", () => {
  test("updates details for a privileged role", async () => {
    const fake = createContext()
    const { context } = fake

    seedInStock(fake, "A1001")

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
    const fake = createContext()
    const { context } = fake

    seedInStock(fake, "A1002")

    const result = await new UpdateAsset(context).run({
      session: makeTestSession("member"),
      code: "A1002",
      details: { name: "Renamed", kind: "pc", serial: null, purchasedOn: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with asset_not_found", async () => {
    const fake = createContext()
    const { context } = fake

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
    const fake = createContext()
    const { context } = fake

    seedInStock(fake, "A1003")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A1003",
    })

    expect(result).toEqual({ reason: "deleted" })

    expect(fake.stored.has("A1003")).toBe(false)
  })

  test("rejects a lent asset with asset_in_use", async () => {
    const fake = createContext()
    const { context } = fake

    seedLent(fake, "A1004")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A1004",
    })

    expectApplicationError(result, ConflictError, "asset_in_use")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const fake = createContext()
    const { context } = fake

    seedInStock(fake, "A1005")

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("member"),
      code: "A1005",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects an unknown code with asset_not_found", async () => {
    const fake = createContext()
    const { context } = fake

    const result = await new DeleteAsset(context).run({
      session: makeTestSession("root"),
      code: "A9999",
    })

    expectApplicationError(result, NotFoundError, "asset_not_found")
  })
})
