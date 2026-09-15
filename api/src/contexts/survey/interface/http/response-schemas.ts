import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { surveyRecordKindSchema } from "@/contexts/survey/domain/survey-record-kind"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import { z } from "zod"

/** ===== survey ===== */
export const zAppSurvey = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questions_json: z.array(z.unknown()),
})

export type AppSurvey = z.infer<typeof zAppSurvey>

export const zAppSurveyList = z.object({
  data: z.array(zAppSurvey),
  total: z.number(),
})

export const zAppSurveyResponse = z.object({
  id: z.number().nullable(),
  survey_id: z.number(),
  respondent_id: zEmployeeId,
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

export type AppSurveyResponse = z.infer<typeof zAppSurveyResponse>

export const zAppSurveyResponseList = z.object({
  data: z.array(zAppSurveyResponse),
  total: z.number(),
})

export const zAppSurveySummaryQuestion = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  distribution: z.record(z.string(), z.number()),
  answers: z.array(z.string()),
})

export const zAppSurveySummary = z.object({
  survey_id: z.number(),
  title: z.string(),
  response_count: z.number(),
  is_truncated: z.boolean(),
  questions: z.array(zAppSurveySummaryQuestion),
})

export const surveySourceFreezeResponseSchema = z.strictObject({ freeze: recordSourceFreezeSnapshotSchema })
export const zAppSurveyCoveragePageReceipt = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), sequence: z.number().int().positive().safe(),
  digest: z.string().regex(/^[0-9a-f]{64}$/), afterCursor: z.string().nullable(),
  nextCursor: z.string().nullable(), checkedAt: z.string().datetime(),
  recordCount: z.number().int().min(0).max(10),
})
export const zAppSurveyRetirementPlan = z.strictObject({
  id: z.uuid(), freezeId: z.uuid(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  totalPages: z.number().int().positive().safe(), recordKinds: z.array(surveyRecordKindSchema).length(2),
  createdAt: z.iso.datetime(),
})
export const zAppSurveyRetirementVerificationReceipt = z.strictObject({
  id: z.uuid(), planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  ordinal: z.number().int().positive().safe(), digest: z.string().regex(/^[0-9a-f]{64}$/),
  coveragePageId: z.uuid(), checkedAt: z.iso.datetime(),
})
export const zAppSurveyRetirementRequest = z.strictObject({
  number: z.number().int().positive().safe(), caseId: z.string().min(1), planId: z.uuid(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/), status: z.string().min(1),
})
export const zAppSurveyRetirementExecution = z.strictObject({ retirement_id: z.uuid(), finalized_at: z.iso.datetime() })
