import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  name: z.string().trim().min(1).max(300),
  planName: z.string().trim().min(1).max(300).nullable(),
  revision: z.number().int().nonnegative(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  renewalDeadline: z.string().nullable(),
  ownerEmployeeId: zEmployeeId.nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  createdAt: z.string(),
})

export type LicenseState = z.infer<typeof zProps>
type Props = LicenseState

/** ライセンス・SaaS 台帳。更新期限・座席数・管理担当の事実のみ持ち、支払や会計連動はしない。 */
export class LicenseEntity implements Props {
  readonly id!: Props["id"]

  readonly name!: Props["name"]

  readonly planName!: Props["planName"]

  readonly revision!: Props["revision"]

  readonly vendor!: Props["vendor"]

  readonly category!: Props["category"]

  readonly seats!: Props["seats"]

  readonly renewalDeadline!: Props["renewalDeadline"]

  readonly ownerEmployeeId!: Props["ownerEmployeeId"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  toJSON(): Props {
    return this.props
  }

  static restore(input: unknown): LicenseEntity | Error {
    const parsed = zProps.safeParse(input)
    if (!parsed.success) return parsed.error
    return new LicenseEntity(parsed.data)
  }

  /** 新規のライセンス記録を組み立てる。id は未採番、status は active。 */
  static create(props: {
    name: string
    planName?: string | null
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: EmployeeId | null
    note: string | null
    createdAt: string
  }): LicenseEntity {
    return new LicenseEntity({
      id: null,
      planName: props.planName ?? null,
      revision: 0,
      name: props.name,
      vendor: props.vendor,
      category: props.category,
      seats: props.seats,
      renewalDeadline: props.renewalDeadline,
      ownerEmployeeId: props.ownerEmployeeId,
      note: props.note,
      status: "active",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: Omit<Props, "status"> & Readonly<{ status: string }>): LicenseEntity {
    return new LicenseEntity({
      id: row.id,
      planName: row.planName,
      revision: row.revision,
      name: row.name,
      vendor: row.vendor,
      category: toCategory(row.category),
      seats: row.seats,
      renewalDeadline: row.renewalDeadline,
      ownerEmployeeId: row.ownerEmployeeId,
      note: row.note,
      status: toStatus(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 台帳の属性（名称・ベンダ・区分・座席数・更新期限・管理担当・備考）を差し替える。 */
  withDetails(details: {
    name: Props["name"]
    planName?: Props["planName"]
    vendor: Props["vendor"]
    category: Props["category"]
    seats: Props["seats"]
    renewalDeadline: Props["renewalDeadline"]
    ownerEmployeeId: Props["ownerEmployeeId"]
    note: Props["note"]
  }): LicenseEntity {
    return new LicenseEntity({
      ...this.props,
      name: details.name,
      planName: details.planName === undefined ? this.planName : details.planName,
      vendor: details.vendor,
      category: details.category,
      seats: details.seats,
      renewalDeadline: details.renewalDeadline,
      ownerEmployeeId: details.ownerEmployeeId,
      note: details.note,
    })
  }

  /** 解約済みに倒した写しを返す。契約履歴を壊さないため物理削除はしない。 */
  cancel(): LicenseEntity {
    return new LicenseEntity({ ...this.props, status: "cancelled" })
  }
}

/** DB の status 文字列を許容値に正規化する。未知値は active に倒す。 */
function toStatus(value: string): Props["status"] {
  return z.enum(["active", "cancelled"]).parse(value)
}

/** DB の category 文字列を返す。未設定は null。 */
function toCategory(value: string | null): Props["category"] {
  return value
}
