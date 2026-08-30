import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Asset } from "@/contexts/asset/domain/entities/asset.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { AssetRepository } from "@/contexts/asset/infrastructure/repositories/asset.repository"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

export type Command = {
  session: CompanySessionValue
  code: string
  employeeCode: string
  now: string
}

/**
 * 権限・在庫・貸出先を確認し、貸出記録の追加と資産の貸出中への更新を
 * 1 回の D1 batch でアトミックに行う。並行リクエストとの競合は条件付き write で防ぐ。
 */
export class LendAsset {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Asset | ApplicationError> {
    const assetRepository = new AssetRepository(this.c)

    const employeeRepository = new CompanyEmployeeDirectoryReadAdapter(this.c)

    if (command.session.hasPermission("asset:manage") === false) {
      return new ForbiddenError("cannot manage assets", "forbidden")
    }

    const asset = await assetRepository.findByCode(command.code)

    if (asset instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: asset })
    }

    if (asset === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    const employee = await employeeRepository.findByCode(command.employeeCode)

    if (employee instanceof Error) {
      return new UnexpectedError("failed to find employee", { cause: employee })
    }

    if (employee === null) {
      return new NotFoundError("employee not found", "employee_not_found")
    }

    if (asset.status !== "in_stock") {
      return new ConflictError("asset is not in stock", "asset_not_in_stock")
    }

    const lent = await assetRepository.lendFromStock({
      assetCode: command.code,
      employeeId: employee.id,
      lentAt: command.now,
    })

    if (lent instanceof Error) {
      return new UnexpectedError("failed to lend asset", { cause: lent })
    }

    if (lent !== null) {
      return lent
    }

    // batch が条件不成立で rollback された。並行リクエストに先を越されたケースを再読込で分類する。
    const current = await assetRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find asset", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("asset not found", "asset_not_found")
    }

    if (current.status !== "in_stock") {
      return new ConflictError("asset is not in stock", "asset_not_in_stock")
    }

    return new UnexpectedError("failed to lend asset")
  }
}
