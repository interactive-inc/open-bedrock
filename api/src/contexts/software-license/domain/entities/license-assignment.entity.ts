import { LicenseError } from "@/contexts/software-license/domain/errors"
import {
  licenseAssignmentSchema,
  type LicenseAssignmentProps,
} from "@/contexts/software-license/domain/schemas/license-assignment.schema"

/** 割当当時のサービス・プランと記録者を保ち、解除後も履歴として残す。 */
export class LicenseAssignmentEntity {
  private constructor(readonly props: LicenseAssignmentProps) {
    Object.freeze(props)
    Object.freeze(this)
  }

  static create(input: unknown): LicenseAssignmentEntity | LicenseError {
    const parsed = licenseAssignmentSchema.safeParse(input)
    if (!parsed.success)
      return new LicenseError("invalid_license", "invalid assignment", { cause: parsed.error })
    return new LicenseAssignmentEntity(parsed.data)
  }

  release(
    input: Readonly<{ at: number; accountId: string; reason: string }>,
  ): LicenseAssignmentEntity | LicenseError {
    if (this.props.released_at !== null)
      return new LicenseError("license_conflict", "assignment is already released")
    return LicenseAssignmentEntity.create({
      ...this.props,
      released_at: input.at,
      released_by: input.accountId,
      release_reason: input.reason,
    })
  }
}
