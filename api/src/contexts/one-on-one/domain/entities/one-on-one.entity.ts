import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { OneOnOneRow } from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  memberId: zEmployeeId,
  managerId: zEmployeeId,
  heldAt: z.string(),
  topics: z.string().nullable(),
  managerNote: z.string().nullable(),
  nextAction: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

const zNewProps = zProps.omit({ id: true })

/** 1on1 1件の記録。集約ルート。 */
export class OneOnOne implements Props {
  readonly id!: Props["id"]

  readonly memberId!: Props["memberId"]

  readonly managerId!: Props["managerId"]

  readonly heldAt!: Props["heldAt"]

  readonly topics!: Props["topics"]

  readonly managerNote!: Props["managerNote"]

  readonly nextAction!: Props["nextAction"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規 1on1 を組み立てる。id は crypto.randomUUID() で採番する。 */
  static create(props: z.infer<typeof zNewProps>): OneOnOne | { reason: "self_reference" } {
    if (props.memberId === props.managerId) {
      return { reason: "self_reference" }
    }

    return new OneOnOne({
      id: crypto.randomUUID(),
      memberId: props.memberId,
      managerId: props.managerId,
      heldAt: props.heldAt,
      topics: props.topics,
      managerNote: props.managerNote,
      nextAction: props.nextAction,
    })
  }

  /** DB の行から復元する。 */
  static fromRow(row: OneOnOneRow): OneOnOne {
    return new OneOnOne({
      id: row.id,
      memberId: row.memberId,
      managerId: row.managerId,
      heldAt: row.heldAt,
      topics: row.topics,
      managerNote: row.managerNote,
      nextAction: row.nextAction,
    })
  }

  /** 記録内容（議題・上長メモ・次のアクション）を差し替えた新しい記録を返す。 */
  withRecord(props: {
    topics: string | null
    managerNote: string | null
    nextAction: string | null
  }): OneOnOne {
    return new OneOnOne({
      ...this.props,
      topics: props.topics,
      managerNote: props.managerNote,
      nextAction: props.nextAction,
    })
  }

  updateTopics(topics: string | null) {
    return new OneOnOne({ ...this.props, topics })
  }

  updateManagerNote(managerNote: string | null) {
    return new OneOnOne({ ...this.props, managerNote })
  }

  updateNextAction(nextAction: string | null) {
    return new OneOnOne({ ...this.props, nextAction })
  }
}
