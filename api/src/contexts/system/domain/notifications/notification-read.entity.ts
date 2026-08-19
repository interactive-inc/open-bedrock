export type NotificationReadProps = Readonly<{
  id: string
  notificationId: string
  userId: string
  readAt: Date
  createdAt: Date
}>

export class NotificationReadEntity {
  readonly id: string
  readonly notificationId: string
  readonly userId: string
  readonly readAt: Date
  readonly createdAt: Date

  private constructor(props: NotificationReadProps) {
    const parsed = zProps.parse(props)

    this.id = parsed.id
    this.notificationId = parsed.notificationId
    this.userId = parsed.userId
    this.readAt = new Date(parsed.readAt.getTime())
    this.createdAt = new Date(parsed.createdAt.getTime())
    Object.freeze(this)
  }

  static create(props: NotificationReadProps): NotificationReadEntity {
    return new NotificationReadEntity(props)
  }
}

export class NotificationReadBatchEntity {
  readonly reads: ReadonlyArray<NotificationReadProps>

  private constructor(entities: ReadonlyArray<NotificationReadEntity>) {
    this.reads = Object.freeze(
      entities.map((entity) =>
        Object.freeze({
          id: entity.id,
          notificationId: entity.notificationId,
          userId: entity.userId,
          readAt: new Date(entity.readAt.getTime()),
          createdAt: new Date(entity.createdAt.getTime()),
        }),
      ),
    )
    Object.freeze(this)
  }

  static create(entities: ReadonlyArray<NotificationReadEntity>): NotificationReadBatchEntity {
    return new NotificationReadBatchEntity(entities)
  }
}
import { z } from "zod"

const zProps = z.object({
  id: z.string().min(1),
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  readAt: z.date(),
  createdAt: z.date(),
})
