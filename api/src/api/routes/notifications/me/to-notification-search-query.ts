import type { NotificationSearchQuery } from "@/api/routes/notifications/notification-search-query"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"

export type Props = {
  isRead: string | undefined
  limit: string | undefined
  offset: string | undefined
}

export function toNotificationSearchQuery(props: Props): NotificationSearchQuery {
  return {
    isRead: toIsRead(props.isRead),
    limit: toBoundedInt({
      raw: props.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    }),
    offset: toBoundedInt({ raw: props.offset, fallback: 0, min: 0, max: MAX_LIST_OFFSET }),
  }
}

function toIsRead(raw: string | undefined): boolean | null {
  if (raw === "true") {
    return true
  }

  if (raw === "false") {
    return false
  }

  return null
}
