import { createClient } from "@/lib/api/hc-client"
import type { CareerApplication } from "@/lib/api/types/career-types"

/** GET /career-applications/me。応募者本人の公募応募一覧を取得する。 */
export async function listMyCareerApplications(): Promise<
  ReadonlyArray<CareerApplication> | Error
> {
  const client = await createClient()

  const response = await client["career-applications"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load career applications")
  }

  const body = await response.json()

  return body.data
}
