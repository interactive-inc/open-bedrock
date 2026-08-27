import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { TrainingEnrollmentResponse } from "@/lib/api/types/training-types"

/** POST /training-enrollments/:id/complete。受講を完了にして更新後の受講を返す。 */
export async function completeTrainingEnrollment(
  enrollmentId: number,
): Promise<TrainingEnrollmentResponse | Error> {
  const client = await createClient()

  const response = await client["training"]["training-enrollments"][":id"].complete.$post({
    param: { id: String(enrollmentId) },
    json: {},
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "受講の完了に失敗しました",
      conflictMessages: {
        "already completed": "この受講は既に完了しています",
      },
    })
  }

  return response.json()
}
