import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  TrainingCourseCreateRequest,
  TrainingCourseResponse,
} from "@/lib/api/types/training-types"

/** POST /training-courses。特権ロールが研修コースを作成する。 */
export async function createTrainingCourse(
  request: TrainingCourseCreateRequest,
): Promise<TrainingCourseResponse | Error> {
  const client = await createClient()

  const response = await client["training"]["training-courses"].$post({
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
    return toResponseError(response, {
      fallback: "研修コースの作成に失敗しました",
      conflictMessages: {
        "course code already exists": "このコースコードは既に使用されています",
      },
    })
  }

  return response.json()
}
