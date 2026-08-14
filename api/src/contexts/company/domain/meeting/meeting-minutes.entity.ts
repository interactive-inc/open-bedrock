import type { MeetingMinutesRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  meetingId: z.number(),
  heldOn: z.string(),
  title: z.string(),
  attendees: z.string().nullable(),
  bodyMd: z.string(),
  authorEmployeeId: z.number(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 議事録。id は新規作成時 null、DB 採番後に確定する。 */
export class MeetingMinutes implements Props {
  readonly id!: Props["id"]

  readonly meetingId!: Props["meetingId"]

  readonly heldOn!: Props["heldOn"]

  readonly title!: Props["title"]

  readonly attendees!: Props["attendees"]

  readonly bodyMd!: Props["bodyMd"]

  readonly authorEmployeeId!: Props["authorEmployeeId"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規議事録を組み立てる。id は未採番のため null。 */
  static create(props: {
    meetingId: number
    heldOn: string
    title: string
    attendees: string | null
    bodyMd: string
    authorEmployeeId: number
    createdAt: string
  }): MeetingMinutes {
    return new MeetingMinutes({
      id: null,
      meetingId: props.meetingId,
      heldOn: props.heldOn,
      title: props.title,
      attendees: props.attendees,
      bodyMd: props.bodyMd,
      authorEmployeeId: props.authorEmployeeId,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: MeetingMinutesRow): MeetingMinutes {
    return new MeetingMinutes({
      id: row.id,
      meetingId: row.meetingId,
      heldOn: row.heldOn,
      title: row.title,
      attendees: row.attendees,
      bodyMd: row.bodyMd,
      authorEmployeeId: row.authorEmployeeId,
      createdAt: row.createdAt,
    })
  }

  /** 開催日・表題・出席者・本文を更新した新しい議事録を返す。 */
  withContent(props: {
    heldOn: string
    title: string
    attendees: string | null
    bodyMd: string
  }): MeetingMinutes {
    return new MeetingMinutes({
      ...this.props,
      heldOn: props.heldOn,
      title: props.title,
      attendees: props.attendees,
      bodyMd: props.bodyMd,
    })
  }
}
