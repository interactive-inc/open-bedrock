import { createClient } from "@/lib/api/hc-client"
import type { TrainingEnrollmentResponse } from "@/lib/api/types/training-types"

/** GET /training/enrollments/me。本人の受講一覧。 */
export async function getMyTrainingEnrollments(): Promise<
  Array<TrainingEnrollmentResponse> | Error
> {
  const client = await createClient()

  const response = await client.training.enrollments.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load my training enrollments")
  }

  const body = await response.json()

  return body.data
}
