import type { CertificateRequestRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  requesterId: z.number(),
  certificateType: z.string(),
  submitTo: z.string().nullable(),
  neededBy: z.string().nullable(),
  note: z.string().nullable(),
  status: z.enum(["requested", "issued", "rejected"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 証明書発行依頼（証明書種別・提出先・希望日・備考の記録。発行判定や計算は持たず記録のみ）。集約ルート。
export class CertificateRequest implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly requesterId!: Props["requesterId"]

  readonly certificateType!: Props["certificateType"]

  readonly submitTo!: Props["submitTo"]

  readonly neededBy!: Props["neededBy"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規証明書発行依頼を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。
  static create(props: {
    requesterId: number
    certificateType: string
    submitTo: string | null
    neededBy: string | null
    note: string | null
    createdAt: string
  }): CertificateRequest {
    return new CertificateRequest({
      id: crypto.randomUUID(),
      requesterId: props.requesterId,
      certificateType: props.certificateType,
      submitTo: props.submitTo,
      neededBy: props.neededBy,
      note: props.note,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: CertificateRequestRow): CertificateRequest {
    return new CertificateRequest({
      id: row.id,
      requesterId: row.requesterId,
      certificateType: row.certificateType,
      submitTo: row.submitTo,
      neededBy: row.neededBy,
      note: row.note,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  // 依頼内容を変更した新しい証明書発行依頼を返す。
  withDetails(props: {
    certificateType: string
    submitTo: string | null
    neededBy: string | null
    note: string | null
  }): CertificateRequest {
    return new CertificateRequest({
      ...this.props,
      certificateType: props.certificateType,
      submitTo: props.submitTo,
      neededBy: props.neededBy,
      note: props.note,
    })
  }
}
