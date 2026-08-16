import { z } from "zod"

/** 汎用 batch job の実行状態。 */
export const batchJobStatusSchema = z.enum(["running", "completed", "failed"])

export type BatchJobStatus = z.infer<typeof batchJobStatusSchema>
