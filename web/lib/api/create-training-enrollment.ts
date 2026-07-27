import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  TrainingEnrollmentCreateRequest,
  TrainingEnrollmentResponse,
} from "@/lib/api/types/training-types"

/** POST /training-enrollments。本人がコースの受講を申し込む。 */
export async function createTrainingEnrollment(
  request: TrainingEnrollmentCreateRequest,
): Promise<TrainingEnrollmentResponse | Error> {
  const client = await createClient()

  const response = await client["training-enrollments"].$post({
    json: { course_code: request.course_code },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "研修の受講申込に失敗しました",
      conflictMessages: {
        "course is archived": "このコースはアーカイブされています",
        "already enrolled": "このコースは既に受講申込済みです",
      },
    })
  }

  return response.json()
}
