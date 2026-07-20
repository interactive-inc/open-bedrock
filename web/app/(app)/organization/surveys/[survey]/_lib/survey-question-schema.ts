import { z } from "zod"

/**
 * questions_json は API 上 unknown 配列で返るため、
 * as を使わず安全に SurveyQuestion へ絞り込むための zod スキーマ。
 */
export const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  text: z.string(),
})
