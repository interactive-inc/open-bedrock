import { z } from "zod"
import type { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"

const schema = z
  .strictObject({
    commandId: z.string().regex(/^\S{1,255}$/),
    employeeId: z.string().regex(/^\S{1,128}$/),
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
    observedOn: z.string().date(),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    reason: z.string().trim().min(1).max(2000),
    recordedAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
  })
  .readonly()

/** 確認した旧等級付与の原記録を保全する依頼。過去の判断者や雇用期間を宣言しない。 */
export class GradeAwardArchiveEntity {
  private constructor(readonly props: z.infer<typeof schema>) {
    Object.freeze(this)
  }

  static create(props: z.input<typeof schema>): GradeAwardArchiveEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError(
        "等級付与の保全条件が不正です",
        "invalid_grade_award_archive",
        { cause: parsed.error },
      )
    return new GradeAwardArchiveEntity(parsed.data)
  }

  validateSource(snapshot: GradeAwardSourceSnapshotValue): CompanyConflictError | null {
    if (
      snapshot.props.value.employeeId !== this.props.employeeId ||
      snapshot.props.value.organizationRevision !== this.props.expectedRevision ||
      snapshot.props.digest !== this.props.snapshotDigest
    ) {
      return new CompanyConflictError(
        "確認した等級付与の記録が変更されています",
        "grade_award_source_conflict",
      )
    }
    return null
  }
}
