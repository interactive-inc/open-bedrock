import type { Asset } from "@/domain/asset/asset.entity"
import { canManageAssets } from "@/lib/asset/can-manage-assets"
import type { Context } from "@/env"
import { AssetRepository } from "@/infrastructure/asset/asset-repository"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Command = {
  viewerRole: string
  code: string
  employeeCode: string
  now: string
}

export type LendForbidden = { reason: "forbidden" }

export type LendAssetNotFound = { reason: "asset_not_found" }

export type LendEmployeeNotFound = { reason: "employee_not_found" }

export type LendAssetNotInStock = { reason: "asset_not_in_stock" }

export type LendAssetFailure =
  | LendForbidden
  | LendAssetNotFound
  | LendEmployeeNotFound
  | LendAssetNotInStock

/**
 * 権限・在庫・貸出先を確認し、貸出記録の追加と資産の貸出中への更新を
 * 1 回の D1 batch でアトミックに行う。並行リクエストとの競合は条件付き write で防ぐ。
 */
export class LendAsset {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Asset | LendAssetFailure | Error> {
    const assetRepository = new AssetRepository(this.c)

    const employeeRepository = new EmployeeRepository(this.c)

    if (canManageAssets(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const asset = await assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return asset
    }

    if (asset === null) {
      return { reason: "asset_not_found" }
    }

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    if (employee === null) {
      return { reason: "employee_not_found" }
    }

    if (asset.status !== "in_stock") {
      return { reason: "asset_not_in_stock" }
    }

    const lent = await assetRepository.lendFromStock({
      assetCode: command.code,
      employeeId: employee.id,
      lentAt: command.now,
    })

    if (lent instanceof Error) {
      return lent
    }

    if (lent !== null) {
      return lent
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "asset_not_found" }
    }

    if (current.status !== "in_stock") {
      return { reason: "asset_not_in_stock" }
    }

    return new Error("failed to lend asset")
  }
}
