import { createClient } from "@/lib/api/hc-client"
import type {
  TrainingEnrollmentRescheduleRequest,
  TrainingEnrollmentResponse,
} from "@/lib/api/types/training-types"

// PUT /training/enrollments/:id。受講期限を変更する。
// 本人以外は 403、完了済みは 409、不存在は 404 を api が返すため、戻りは Error になる。
export async function rescheduleTrainingEnrollment(
  id: number,
  request: TrainingEnrollmentRescheduleRequest,
): Promise<TrainingEnrollmentResponse | Error> {
  const client = await createClient()

  const response = await client.training.enrollments[":id"].$put({
    param: { id: String(id) },
    json: { due_date: request.due_date ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to reschedule training enrollment")
  }

  return response.json()
}
