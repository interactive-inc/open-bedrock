import { createClient } from "@/lib/api/hc-client"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

// GET /training/courses/:code。指定コードの研修コース詳細を取得する。
export async function getTrainingCourse(code: string): Promise<TrainingCourseResponse | Error> {
  const client = await createClient()

  const response = await client.training.courses[":code"].$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("failed to load training course")
  }

  return response.json()
}
