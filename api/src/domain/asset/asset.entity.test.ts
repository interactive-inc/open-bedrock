import { Asset } from "@/domain/asset/asset.entity"
import { describe, expect, test } from "bun:test"

describe("Asset.create", () => {
  test("builds with in_stock status and null holderEmployeeId", () => {
    const asset = Asset.create({
      code: "A-001",
      name: "Laptop",
      kind: "pc",
      serial: "SN-12345",
      purchasedOn: "2026-04-01",
    })

    expect(asset).toBeInstanceOf(Asset)
    expect(asset.code).toBe("A-001")
    expect(asset.name).toBe("Laptop")
    expect(asset.kind).toBe("pc")
    expect(asset.serial).toBe("SN-12345")
    expect(asset.purchasedOn).toBe("2026-04-01")
    expect(asset.status).toBe("in_stock")
    expect(asset.holderEmployeeId).toBeNull()
  })
})

describe("Asset.withDetails", () => {
  test("returns new Asset with changed details preserving status", () => {
    const asset = Asset.create({
      code: "A-001",
      name: "Laptop",
      kind: "pc",
      serial: "SN-12345",
      purchasedOn: "2026-04-01",
    })

    const updated = asset.withDetails({
      name: "Desktop",
      kind: "workstation",
      serial: "SN-99999",
      purchasedOn: "2026-05-01",
    })

    expect(updated).toBeInstanceOf(Asset)
    expect(updated.name).toBe("Desktop")
    expect(updated.kind).toBe("workstation")
    expect(updated.serial).toBe("SN-99999")
    expect(updated.purchasedOn).toBe("2026-05-01")
    expect(updated.code).toBe("A-001")
    expect(updated.status).toBe("in_stock")
    expect(updated.holderEmployeeId).toBeNull()
  })
})

describe("Asset.withDisposed", () => {
  test("returns new Asset in disposed status recording reason and date", () => {
    const asset = Asset.create({
      code: "A-001",
      name: "Laptop",
      kind: "pc",
      serial: "SN-12345",
      purchasedOn: "2026-04-01",
    })

    const disposed = asset.withDisposed({ disposedOn: "2026-07-01", reason: "故障" })

    expect(disposed).toBeInstanceOf(Asset)
    expect(disposed.status).toBe("disposed")
    expect(disposed.disposedOn).toBe("2026-07-01")
    expect(disposed.disposalReason).toBe("故障")
    expect(disposed.holderEmployeeId).toBeNull()
  })
})
