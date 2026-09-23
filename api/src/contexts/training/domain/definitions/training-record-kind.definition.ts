import { z } from "zod"

export const trainingRecordKinds = ["training-course-record", "training-enrollment-record"] as const

export const trainingRecordKindSchema = z.enum(trainingRecordKinds)
export type TrainingRecordKind = z.infer<typeof trainingRecordKindSchema>
