import type { z } from "zod"

export type SessionEmployeeStatus = "active" | "leave" | "retired"
export type SessionAccountId = string & z.$brand<"AccountId">

type Props<AccountId extends string> = {
  accountId: AccountId
  employeeId: number
  employeeStatus: SessionEmployeeStatus
  permissions: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}

/**
 * 認証済みの本人（セッション）。verify-bearer が JWT 検証後に DB から権限を解決して生成する。
 * permissions/roleKeys が認可の正
 */
export class Session<AccountId extends string = SessionAccountId> implements Props<AccountId> {
  constructor(private readonly props: Props<AccountId>) {
    Object.freeze(this)
  }

  get accountId(): AccountId {
    return this.props.accountId
  }

  get employeeId(): number {
    return this.props.employeeId
  }

  get employeeStatus(): SessionEmployeeStatus {
    return this.props.employeeStatus
  }

  get permissions(): ReadonlySet<string> {
    return this.props.permissions
  }

  get roleKeys(): ReadonlyArray<string> {
    return this.props.roleKeys
  }

  /**
   * 指定 permission を持つか判定する、認可の唯一の判定関数。
   * DB 解決済みの permissions Set を見るだけで、role 文字列ではなく permission キーで判定する。
   * 未知キー・解決失敗は permissions に無いので deny(fail-closed)
   */
  hasPermission(permission: string): boolean {
    return permission.length > 0 && this.props.permissions.has(permission)
  }
}
