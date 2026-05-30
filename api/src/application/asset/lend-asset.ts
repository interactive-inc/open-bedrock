import type { Asset } from "@/domain/asset/asset"
import { AssetLending } from "@/domain/asset/asset-lending"
import { canManageAssets } from "@/domain/asset/can-manage-assets"
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
 * 権限・在庫・貸出先を確認し、貸出記録を起こして資産を貸出中に更新する。
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

    const lending = await assetRepository.addLending(
      AssetLending.create({
        assetCode: command.code,
        employeeId: employee.id,
        lentAt: command.now,
      }),
    )

    if (lending instanceof Error) {
      return lending
    }

    const updated = await assetRepository.update(asset.withLendStatus("lent", employee.id))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return new Error("failed to update asset after lending")
    }

    return updated
  }
}
