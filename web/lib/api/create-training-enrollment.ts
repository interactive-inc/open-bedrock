import { createClient } from "@/lib/api/hc-client"
import type {
  TrainingEnrollmentCreateRequest,
  TrainingEnrollmentResponse,
} from "@/lib/api/types/training-types"

// POST /training/enrollments。本人がコースの受講を申し込む。
export async function createTrainingEnrollment(
  request: TrainingEnrollmentCreateRequest,
): Promise<TrainingEnrollmentResponse | Error> {
  const client = await createClient()

  const response = await client.training.enrollments.$post({
    json: { course_code: request.course_code },
  })

  if (response.status >= 400) {
    return new Error("failed to create training enrollment")
  }

  return response.json()
}
