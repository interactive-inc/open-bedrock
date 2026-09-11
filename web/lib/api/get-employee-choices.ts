import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 職員選択に必要な識別子・氏名だけを返し、検索とページ送りを維持する。 */
export async function getEmployeeChoices(query: string, offset: number) {
  const client = await createClient()
  const response = await client.company["employee-directory"].$get({
    query: { q: query || undefined, status: "active", limit: "50", offset: String(offset) },
  })
  if (!response.ok) return toResponseError(response, { fallback: "職員を取得できませんでした" })
  const directory = await response.json()
  return {
    employees: directory.data.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
    })),
    total: directory.total,
  }
}
