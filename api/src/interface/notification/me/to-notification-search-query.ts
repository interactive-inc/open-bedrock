import type { NotificationSearchQuery } from "@/domain/notification/notification-search-query"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"

export type Props = { isRead: string | null; limit: string | null; offset: string | null }

export function toNotificationSearchQuery(props: Props): NotificationSearchQuery {
  return {
    isRead: toIsRead(props.isRead),
    limit: toBoundedInt({
      raw: props.limit ?? undefined,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    }),
    offset: toBoundedInt({
      raw: props.offset ?? undefined,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    }),
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
