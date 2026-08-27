import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

/** GET /training-courses/:code。指定コードの研修コース詳細を取得する。 */
export async function getTrainingCourse(code: string): Promise<TrainingCourseResponse | Error> {
  const client = await createClient()

  const response = await client["training"]["training-courses"][":code"].$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load training course")
  }

  return response.json()
}
