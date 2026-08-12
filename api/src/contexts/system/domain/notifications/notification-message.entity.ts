import { InvalidNotificationMessageError } from "@system/domain/notifications/invalid-notification-message.error"
import { z } from "zod"

const namespacedVocabularyPattern =
  /^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u

function hasTitleControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)

    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
  })
}

function hasBodyControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)

    return (
      codePoint !== undefined &&
      (codePoint <= 0x08 ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f)
    )
  })
}

export const notificationMessageIdSchema = z
  .string()
  .min(1)
  .max(255)
  .brand<"NotificationMessageId">()

export type NotificationMessageId = z.infer<typeof notificationMessageIdSchema>

export const notificationKindSchema = z.string().min(3).max(100).regex(namespacedVocabularyPattern)

export const notificationSourceReferenceSchema = z
  .object({
    type: notificationKindSchema,
    id: z.string().min(1).max(512),
  })
  .strict()

export type NotificationSourceReference = Readonly<
  z.output<typeof notificationSourceReferenceSchema>
>

const titleSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((title) => title.trim().length > 0)
  .refine((title) => !hasTitleControlCharacter(title))

const bodySchema = z
  .string()
  .min(1)
  .max(10_000)
  .refine((body) => body.trim().length > 0)
  .refine((body) => !hasBodyControlCharacter(body))

const propsSchema = z
  .object({
    id: notificationMessageIdSchema,
    kind: notificationKindSchema,
    title: titleSchema,
    body: bodySchema.nullable(),
    source: notificationSourceReferenceSchema.nullable(),
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/**
 * 受信者と既読状態を所有しないimmutableなSystem通知本文。
 * titleとbodyはpresentation層がmarkupとして解釈せずplain textとして表示する。
 */
export class NotificationMessage {
  readonly id: NotificationMessageId
  readonly kind: string
  readonly title: string
  readonly body: string | null
  readonly source: NotificationSourceReference | null
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.kind = props.kind
    this.title = props.title
    this.body = props.body
    this.source =
      props.source === null ? null : Object.freeze({ type: props.source.type, id: props.source.id })
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): NotificationMessage | InvalidNotificationMessageError {
    const parsed = propsSchema.safeParse(input)

    return parsed.success
      ? new NotificationMessage(parsed.data)
      : new InvalidNotificationMessageError("invalid_shape", parsed.error)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }
}
