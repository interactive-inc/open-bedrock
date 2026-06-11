import { createClient } from "@/lib/api/hc-client"

// 募集中の社内公募一覧を取得する。GET /career/postings。
export async function getCareerPostings() {
  const client = await createClient()

  const response = await client.career.postings.$get()

  if (response.status >= 400) {
    return new Error("failed to load career postings")
  }

  const body = await response.json()

  return body.data
}
