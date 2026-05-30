import { createClient } from "@/lib/api/hc-client"

// GET /templates/:code。指定コードの申請テンプレ詳細。
export async function getApplicationTemplate(code: string) {
  const client = await createClient()

  const response = await client.templates[":code"].$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("failed to load application template")
  }

  return response.json()
}
