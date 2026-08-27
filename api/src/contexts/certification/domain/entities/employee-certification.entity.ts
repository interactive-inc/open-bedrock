import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeCertificationRow } from "@/contexts/certification/infrastructure/schema/certification"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  employeeId: zEmployeeId,
  certificationId: z.number(),
  acquiredOn: z.string(),
  expiresOn: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 従業員の資格保有記録。取得日・有効期限つきの台帳（更新要否の判定はしない）。
 */
export class EmployeeCertification implements Props {
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly certificationId!: Props["certificationId"]

  readonly acquiredOn!: Props["acquiredOn"]

  readonly expiresOn!: Props["expiresOn"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: EmployeeCertificationRow): EmployeeCertification {
    return new EmployeeCertification({
      id: row.id,
      employeeId: row.employeeId,
      certificationId: row.certificationId,
      acquiredOn: row.acquiredOn,
      expiresOn: row.expiresOn,
      note: row.note,
      createdAt: row.createdAt,
    })
  }
}
