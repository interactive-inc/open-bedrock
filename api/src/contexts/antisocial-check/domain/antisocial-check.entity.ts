import type { AntisocialCheckRow } from "@/contexts/antisocial-check/infrastructure/schema/antisocial-check"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  requesterId: z.number(),
  partnerName: z.string(),
  partnerAddress: z.string().nullable(),
  representativeName: z.string().nullable(),
  result: z.string().nullable(),
  status: z.enum(["requested", "completed"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 反社チェックの申請（取引先の確認情報と判定結果を記録）。集約ルート。 */
export class AntisocialCheck implements Props {
  /** id は UUID。新規作成時に採番する。 */
  readonly id!: Props["id"]

  readonly requesterId!: Props["requesterId"]

  readonly partnerName!: Props["partnerName"]

  readonly partnerAddress!: Props["partnerAddress"]

  readonly representativeName!: Props["representativeName"]

  readonly result!: Props["result"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規反社チェック申請を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。 */
  static create(props: {
    requesterId: number
    partnerName: string
    partnerAddress: string | null
    representativeName: string | null
    createdAt: string
  }): AntisocialCheck {
    return new AntisocialCheck({
      id: crypto.randomUUID(),
      requesterId: props.requesterId,
      partnerName: props.partnerName,
      partnerAddress: props.partnerAddress,
      representativeName: props.representativeName,
      result: null,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: AntisocialCheckRow): AntisocialCheck {
    return new AntisocialCheck({
      id: row.id,
      requesterId: row.requesterId,
      partnerName: row.partnerName,
      partnerAddress: row.partnerAddress,
      representativeName: row.representativeName,
      result: row.result,
      status: zProps.shape.status.parse(row.status),
      createdAt: row.createdAt,
    })
  }

  /** 申請内容と判定結果を変更した新しい反社チェック申請を返す。 */
  withDetails(props: {
    partnerName: string
    partnerAddress: string | null
    representativeName: string | null
    result: string | null
  }): AntisocialCheck {
    return new AntisocialCheck({
      ...this.props,
      partnerName: props.partnerName,
      partnerAddress: props.partnerAddress,
      representativeName: props.representativeName,
      result: props.result,
      status: props.result === null ? this.status : "completed",
    })
  }
}
