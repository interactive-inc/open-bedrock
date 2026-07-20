import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  TrainingCourseResponse,
  TrainingCourseUpdateRequest,
} from "@/lib/api/types/training-types"

/**
 * PUT /training/courses/:code。管理権限が研修コースの内容を変更する。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function updateTrainingCourse(
  code: string,
  request: TrainingCourseUpdateRequest,
): Promise<TrainingCourseResponse | Error> {
  const client = await createClient()

  const response = await client.training.courses[":code"].$put({
    param: { code: code },
    json: {
      title: request.title,
      category: request.category,
      description: request.description ?? undefined,
      duration_minutes: request.duration_minutes ?? undefined,
      is_required: request.is_required,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "研修コースの変更に失敗しました",
      conflictMessages: {
        "course is archived": "このコースはアーカイブされています",
      },
    })
  }

  return response.json()
}
