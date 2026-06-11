import { createClient } from "@/lib/api/hc-client"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

// GET /training/courses。全ユーザーが研修コース一覧を閲覧できる。
export async function getTrainingCourses(): Promise<Array<TrainingCourseResponse> | Error> {
  const client = await createClient()

  const response = await client.training.courses.$get({ query: {} })

  if (response.status >= 400) {
    return new Error("failed to load training courses")
  }

  const body = await response.json()

  return body.data
}
