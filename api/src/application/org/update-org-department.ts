import type { Session } from "@/lib/auth/session"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { OrgDepartment } from "@/domain/org/org-department.entity"
import type { Context } from "@/env"
import { OrgDepartmentRepository } from "@/infrastructure/org/org-department-repository"

export type Command = {
  session: Session
  code: string
  parentCode: string | null
  managerEmployeeCode?: string | null
  order: number
}

/**
 * 権限を確認し、部署ノードの親・責任者・表示順を変更する。
 * 自分自身を親にする直接自己参照、および間接的な循環参照を拒否する。
 */
export class UpdateOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OrgDepartment | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (command.session.hasPermission("org:manage") === false) {
      return new ForbiddenError("cannot manage org", "forbidden")
    }

    if (command.parentCode === command.code) {
      return new ValidationError("a department cannot be its own parent", "invalid_parent")
    }

    const current = await departmentRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    if (
      command.managerEmployeeCode !== undefined &&
      command.managerEmployeeCode !== current.managerEmployeeCode
    ) {
      return new ConflictError(
        "department responsibility must be changed with a personnel action",
        "lifecycle_action_required",
      )
    }

    const parentChecked = await this.ensureParentExists(command.parentCode)

    if (parentChecked !== null) {
      return parentChecked
    }

    // 間接的な循環参照を検出する。
    // 新しい親から親チェーンを辿り、自分自身（code）に到達したら循環として拒否する。
    if (command.parentCode !== null) {
      const circularCheck = await this.detectCircularReference(
        departmentRepository,
        command.code,
        command.parentCode,
      )

      if (circularCheck instanceof Error) {
        return new UnexpectedError("failed to find departments", { cause: circularCheck })
      }

      if (circularCheck) {
        return new ConflictError(
          "circular reference detected in department hierarchy",
          "circular_reference",
        )
      }
    }

    const updated = current.withParent(command.parentCode).updateOrder(command.order)

    const saved = await departmentRepository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update department", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    return saved
  }

  /**
   * 新しい parentCode から親チェーンを辿り、code に到達するかを判定する。
   * 全部署を 1 回ロードして in-memory で探索する（部署数は少ない前提）。
   * visited ガードにより、既存データに循環がある場合でも無限ループしない。
   */
  private async detectCircularReference(
    repository: OrgDepartmentRepository,
    code: string,
    newParentCode: string,
  ): Promise<boolean | Error> {
    const allDepartments = await repository.findAll()

    if (allDepartments instanceof Error) {
      return allDepartments
    }

    const parentByCode = new Map<string, string | null>()

    for (const department of allDepartments) {
      parentByCode.set(department.code, department.parentCode)
    }

    // 変更後の親チェーンをシミュレートするため、自分のエントリを更新する。
    parentByCode.set(code, newParentCode)

    const visited = new Set<string>()

    let current: string | null | undefined = newParentCode

    while (current !== null && current !== undefined) {
      if (current === code) {
        return true
      }

      if (visited.has(current)) {
        // 既存データに循環がある（自分とは無関係）。無限ループを防いで抜ける。
        break
      }

      visited.add(current)

      current = parentByCode.get(current) ?? null
    }

    return false
  }

  /** 親コードが存在するか確認する。存在すれば null、不正なら返すべき ApplicationError を返す。 */
  private async ensureParentExists(parentCode: string | null): Promise<ApplicationError | null> {
    if (parentCode === null) {
      return null
    }

    const parent = await new OrgDepartmentRepository(this.c).findByCode(parentCode)

    if (parent instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: parent })
    }

    if (parent === null) {
      return new NotFoundError("parent department not found", "parent_not_found")
    }

    return null
  }
}
