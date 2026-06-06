"use server"

import { getEmployeeList } from "@/lib/api/get-employee-list"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

// クライアントの EmployeeCombobox から呼ぶ従業員検索 Server Action。
// GET /employees（q で name/code/email 部分一致）をラップし、結果配列のみをクライアントへ渡す。
// hc-client は next/headers に依存するため、client から直接 getEmployeeList は呼べない。
// 取得失敗時は空配列を返し、未選択扱いとして送信バリデーションで弾く。
export async function searchRecipientsAction(
  query: string,
): Promise<ReadonlyArray<EmployeeListItem>> {
  const trimmedQuery = query.trim()

  if (trimmedQuery === "") {
    return []
  }

  const employees = await getEmployeeList({ q: trimmedQuery, dept: null, status: null })

  if (employees instanceof Error) {
    return []
  }

  return employees
}
