import { createClient } from "@/lib/api/hc-client"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

type TrainingCourseListResult = {
  data: Array<TrainingCourseResponse>
  total: number
}

/** GET /training-courses。全ユーザーが研修コース一覧を閲覧できる。 */
export async function getTrainingCourses(props: {
  limit: number
  offset: number
}): Promise<TrainingCourseListResult | Error> {
  const client = await createClient()

  const response = await client["training-courses"].$get({
    query: { limit: String(props.limit), offset: String(props.offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load training courses")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
