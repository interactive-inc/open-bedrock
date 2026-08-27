import type { $brand } from "zod"

/** API composition が検証済みの System Account ID を渡すための中立な契約。 */
export type AuthenticatedAccountId = string & $brand<"AccountId">

/** API composition が検証済みの Company Employee ID を渡すための中立な契約。 */
export type AuthenticatedEmployeeId = string & $brand<"WorkforceId:employee">

/** API composition が解決済みの在籍状態。 */
export type AuthenticatedEmploymentStatus = "PRE_HIRE" | "ACTIVE" | "ON_LEAVE" | "TERMINATED"

type Props = {
  accountId: AuthenticatedAccountId
  employeeId: AuthenticatedEmployeeId
  employmentStatus: AuthenticatedEmploymentStatus
  permissions: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}

/**
 * 認証済みの本人（セッション）。verify-bearer が JWT 検証後に DB から権限を解決して生成する。
 * permissions/roleKeys が認可の正
 */
export class Session implements Props {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  get accountId(): AuthenticatedAccountId {
    return this.props.accountId
  }

  get employeeId(): AuthenticatedEmployeeId {
    return this.props.employeeId
  }

  get employmentStatus(): AuthenticatedEmploymentStatus {
    return this.props.employmentStatus
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
