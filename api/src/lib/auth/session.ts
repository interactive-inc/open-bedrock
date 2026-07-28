import type { PermissionKey } from "@/lib/auth/permission-keys"
import type { EmployeeStatus } from "@/lib/schemas"

type Props = {
  accountId: number
  employeeId: number
  employeeStatus: EmployeeStatus
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

  get accountId(): number {
    return this.props.accountId
  }

  get employeeId(): number {
    return this.props.employeeId
  }

  get employeeStatus(): EmployeeStatus {
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
  hasPermission(key: PermissionKey): boolean {
    return this.props.permissions.has(key)
  }
}
