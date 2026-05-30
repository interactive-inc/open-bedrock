import type { NotificationSearchQuery } from "@/domain/notification/notification-search-query"

export type Props = {
  isRead: string | null
  limit: string | null
}

export function toNotificationSearchQuery(props: Props): NotificationSearchQuery {
  return {
    isRead: toIsRead(props.isRead),
    limit: toLimit(props.limit),
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

function toLimit(raw: string | null): number | null {
  if (raw === null) {
    return null
  }

  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}
