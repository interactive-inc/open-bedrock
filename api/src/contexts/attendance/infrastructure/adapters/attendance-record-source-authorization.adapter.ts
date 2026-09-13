import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"

/** 全打刻の収集資格と発行元を確認し、取得・確定時にも失効を検出する。 */
export class AttendanceRecordSourceAuthorizationAdapter {
  constructor(private readonly c: AttendanceRecordSourceContext) {
    Object.freeze(this)
  }

  async prepare() {
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined) return new Error("attendance source authentication required")
    const now = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      now,
    )
    if (proof instanceof Error) return proof
    if (
      proof === null ||
      (!proof.permissionKeys.has("attendance:read:all") &&
        !proof.permissionKeys.has("system:admin"))
    )
      return new Error("attendance source access denied")
    const assertions = proof.assertions(now)
    if (assertions instanceof Error) return assertions
    return Object.freeze({ accountId: authentication.accountId, now, assertions })
  }
}
