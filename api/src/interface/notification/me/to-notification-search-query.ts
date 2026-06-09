import type { NotificationSearchQuery } from "@/domain/notification/notification-search-query"

const defaultLimit = 50

const maxLimit = 100

export type Props = {
  isRead: string | null
  limit: string | null
  offset: string | null
}

export function toNotificationSearchQuery(props: Props): NotificationSearchQuery {
  return {
    isRead: toIsRead(props.isRead),
    limit: toBoundedInt({ raw: props.limit, fallback: defaultLimit, min: 1, max: maxLimit }),
    offset: toBoundedInt({ raw: props.offset, fallback: 0, min: 0, max: Number.MAX_SAFE_INTEGER }),
  }
}

function toIsRead(raw: string | null): boolean | null {
  if (raw === "true") {
    return true
  }

  if (raw === "false") {
    return false
  }

  return null
}

function toBoundedInt(props: {
  raw: string | null
  fallback: number
  min: number
  max: number
}): number {
  if (props.raw === null) {
    return props.fallback
  }

  const parsed = Number.parseInt(props.raw, 10)

  if (Number.isNaN(parsed) || parsed < props.min) {
    return props.fallback
  }

  return parsed > props.max ? props.max : parsed
}
