import { createClient } from "@/lib/api/hc-client"
import type { TrainingEnrollmentResponse } from "@/lib/api/types/training-types"

// POST /training/enrollments/:id/complete。受講を完了にして更新後の受講を返す。
export async function completeTrainingEnrollment(
  enrollmentId: number,
): Promise<TrainingEnrollmentResponse | Error> {
  const client = await createClient()

  const response = await client.training.enrollments[":id"].complete.$post({
    param: { id: String(enrollmentId) },
    json: {},
  })

  if (response.status >= 400) {
    return new Error("failed to complete training enrollment")
  }

  return response.json()
}
