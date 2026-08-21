import type { PartnerRow } from "@/contexts/partner/infrastructure/schema/partner"
import { z } from "zod"

/** D1 batch の結果行を安全にパースする。fromRow の引数型に対応する。 */
export const partnerRowSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporateNumber: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
})

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporateNumber: z.string().nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 取引先台帳の1件。id は新規作成時 null、DB 採番後に確定する。 */
export class Partner implements Props {
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly name!: Props["name"]

  readonly category!: Props["category"]

  readonly corporateNumber!: Props["corporateNumber"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規登録する取引先を組み立てる。id は未採番、初期状態は active。 */
  static create(props: {
    code: string
    name: string
    category: string | null
    corporateNumber: string | null
    note: string | null
    createdAt: string
  }): Partner {
    return new Partner({
      id: null,
      code: props.code,
      name: props.name,
      category: props.category,
      corporateNumber: props.corporateNumber,
      note: props.note,
      status: "active",
      createdAt: props.createdAt,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: PartnerRow): Partner {
    return new Partner({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      corporateNumber: row.corporateNumber,
      note: row.note,
      status: toPartnerStatus(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 名称・分類・法人番号・備考を差し替える。code と状態は保つ。 */
  withDetails(details: {
    name: Props["name"]
    category: Props["category"]
    corporateNumber: Props["corporateNumber"]
    note: Props["note"]
  }): Partner {
    return new Partner({
      ...this.props,
      name: details.name,
      category: details.category,
      corporateNumber: details.corporateNumber,
      note: details.note,
    })
  }

  /** 取引を終了しアーカイブした取引先を返す。 */
  archive(): Partner {
    return new Partner({
      ...this.props,
      status: "archived",
    })
  }
}

/** DB の status 文字列を許容値へ寄せる。未知値は active とみなす。 */
function toPartnerStatus(value: string): Props["status"] {
  return value === "archived" ? "archived" : "active"
}
