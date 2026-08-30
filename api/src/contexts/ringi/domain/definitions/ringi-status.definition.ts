import { z } from "zod"

export const ringiStatusSchema = z.enum(["pending", "approved", "rejected"])

export type RingiStatus = z.infer<typeof ringiStatusSchema>
