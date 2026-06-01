import { createClient } from "@/lib/api/hc-client"
import type {
  TrainingCourseCreateRequest,
  TrainingCourseResponse,
} from "@/lib/api/types/training-types"

// POST /training/courses。特権ロールが研修コースを作成する。
export async function createTrainingCourse(
  request: TrainingCourseCreateRequest,
): Promise<TrainingCourseResponse | Error> {
  const client = await createClient()

  const response = await client.training.courses.$post({
    json: {
      code: request.code,
      title: request.title,
      category: request.category,
      description: request.description ?? undefined,
      duration_minutes: request.duration_minutes ?? undefined,
      is_required: request.is_required,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create training course")
  }

  return response.json()
}
