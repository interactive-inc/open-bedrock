"use server"

import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"
import { requireAuth } from "@/lib/auth/require-auth"

// クライアントの EmployeeCombobox から呼ぶ従業員検索 Server Action。
// GET /directory/employees（q で name/code 部分一致）をラップし、結果配列のみをクライアントへ渡す。
// hc-client は next/headers に依存するため、client から直接 API 関数は呼べない。
// 取得失敗時は空配列を返し、未選択扱いとして送信バリデーションで弾く。
export async function searchRecipientsAction(
  query: string,
): Promise<ReadonlyArray<EmployeeListItem>> {
  await requireAuth()

  const trimmedQuery = query.trim()

  if (trimmedQuery === "") {
    return []
  }

  const result = await getEmployeeDirectory({ q: trimmedQuery })

  if (result instanceof Error) {
    return []
  }

  return result.items
}
