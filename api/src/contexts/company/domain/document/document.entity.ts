import type { DocumentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partnerCode: z.string().nullable(),
  expiresOn: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 文書台帳の1件。本体ファイルは持たず、所在と期限などのメタデータのみ記録する。 */
export class Document implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly category!: Props["category"]

  readonly location!: Props["location"]

  readonly partnerCode!: Props["partnerCode"]

  readonly expiresOn!: Props["expiresOn"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規文書を組み立てる。id は未採番。 */
  static create(props: {
    title: string
    category: string | null
    location: string
    partnerCode: string | null
    expiresOn: string | null
    note: string | null
    createdAt: string
  }): Document {
    return new Document({
      id: null,
      title: props.title,
      category: props.category,
      location: props.location,
      partnerCode: props.partnerCode,
      expiresOn: props.expiresOn,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: DocumentRow): Document {
    return new Document({
      id: row.id,
      title: row.title,
      category: row.category,
      location: row.location,
      partnerCode: row.partnerCode,
      expiresOn: row.expiresOn,
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 表題・分類・所在・取引先・期限・備考を差し替えた新しい文書を返す。 */
  withDetails(details: {
    title: string
    category: string | null
    location: string
    partnerCode: string | null
    expiresOn: string | null
    note: string | null
  }): Document {
    return new Document({
      ...this.props,
      title: details.title,
      category: details.category,
      location: details.location,
      partnerCode: details.partnerCode,
      expiresOn: details.expiresOn,
      note: details.note,
    })
  }
}
