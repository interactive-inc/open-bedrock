// このファイルは `bun run gen:composition` が生成する。手で編集しない。
import { readInboxCountsExpense } from "@/api/http/inbox/providers/expense"
import { readInboxCountsLeave } from "@/api/http/inbox/providers/leave"
import { readInboxCountsShift } from "@/api/http/inbox/providers/shift"
import { readInboxCountsThanks } from "@/api/http/inbox/providers/thanks"

/** 業務contextごとの未処理件数の取得。src/api/http/inbox/providers/*.ts から生成する。 */
export const INBOX_COUNT_PROVIDERS = [
  readInboxCountsExpense,
  readInboxCountsLeave,
  readInboxCountsShift,
  readInboxCountsThanks,
] as const
