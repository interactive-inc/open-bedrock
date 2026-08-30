import { z } from "zod"

/** YYYY-MM 形式の月次期間。 */
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力してください")
