import type { LicenseRow } from "@/contexts/software-license/infrastructure/schema/software-license"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  name: z.string(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().int().nullable(),
  renewalDeadline: z.string().nullable(),
  ownerEmployeeId: z.number().int().nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** ライセンス・SaaS 台帳。更新期限・座席数・管理担当の事実のみ持ち、支払や会計連動はしない。 */
export class License implements Props {
  readonly id!: Props["id"]

  readonly name!: Props["name"]

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

  /** 新規のライセンス記録を組み立てる。id は未採番、status は active。 */
  static create(props: {
    name: string
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: number | null
    note: string | null
    createdAt: string
  }): License {
    return new License({
      id: null,
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

  static fromRow(row: LicenseRow): License {
    return new License({
      id: row.id,
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
    vendor: Props["vendor"]
    category: Props["category"]
    seats: Props["seats"]
    renewalDeadline: Props["renewalDeadline"]
    ownerEmployeeId: Props["ownerEmployeeId"]
    note: Props["note"]
  }): License {
    return new License({
      ...this.props,
      name: details.name,
      vendor: details.vendor,
      category: details.category,
      seats: details.seats,
      renewalDeadline: details.renewalDeadline,
      ownerEmployeeId: details.ownerEmployeeId,
      note: details.note,
    })
  }

  /** 解約済みに倒した写しを返す。契約履歴を壊さないため物理削除はしない。 */
  cancel(): License {
    return new License({ ...this.props, status: "cancelled" })
  }
}

/** DB の status 文字列を許容値に正規化する。未知値は active に倒す。 */
function toStatus(value: string): Props["status"] {
  return value === "cancelled" ? "cancelled" : "active"
}

/** DB の category 文字列を返す。未設定は null。 */
function toCategory(value: string | null): Props["category"] {
  return value
}
