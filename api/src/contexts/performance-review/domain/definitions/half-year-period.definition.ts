import { z } from "zod"

/** YYYY-H1 / YYYY-H2 形式の評価期間ラベル。 */
export const halfYearPeriod = z
  .string()
  .regex(/^\d{4}-H[12]$/, "YYYY-H1 または YYYY-H2 の形式で入力してください")
