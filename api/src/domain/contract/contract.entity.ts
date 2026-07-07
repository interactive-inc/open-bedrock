import type { ContractRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  partnerId: z.number(),
  title: z.string(),
  contractDate: z.string(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  renewalDeadline: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 契約記録。契約日・期間・更新期限の事実のみ持ち、レビューや法的判定はしない。 */
export class Contract implements Props {
  readonly id!: Props["id"]

  readonly partnerId!: Props["partnerId"]

  readonly title!: Props["title"]

  readonly contractDate!: Props["contractDate"]

  readonly startsOn!: Props["startsOn"]

  readonly endsOn!: Props["endsOn"]

  readonly renewalDeadline!: Props["renewalDeadline"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規契約記録を組み立てる。id は未採番。 */
  static create(props: {
    partnerId: number
    title: string
    contractDate: string
    startsOn: string | null
    endsOn: string | null
    renewalDeadline: string | null
    note: string | null
    createdAt: string
  }): Contract {
    return new Contract({
      id: null,
      partnerId: props.partnerId,
      title: props.title,
      contractDate: props.contractDate,
      startsOn: props.startsOn,
      endsOn: props.endsOn,
      renewalDeadline: props.renewalDeadline,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: ContractRow): Contract {
    return new Contract({
      id: row.id,
      partnerId: row.partnerId,
      title: row.title,
      contractDate: row.contractDate,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      renewalDeadline: row.renewalDeadline,
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 表題・契約日・期間・更新期限・備考を差し替える。partner_id は保つ。 */
  withDetails(details: {
    title: Props["title"]
    contractDate: Props["contractDate"]
    startsOn: Props["startsOn"]
    endsOn: Props["endsOn"]
    renewalDeadline: Props["renewalDeadline"]
    note: Props["note"]
  }): Contract {
    return new Contract({
      ...this.props,
      title: details.title,
      contractDate: details.contractDate,
      startsOn: details.startsOn,
      endsOn: details.endsOn,
      renewalDeadline: details.renewalDeadline,
      note: details.note,
    })
  }
}
