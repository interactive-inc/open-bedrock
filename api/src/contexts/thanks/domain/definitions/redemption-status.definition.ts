import { z } from "zod"

export const redemptionStatusSchema = z.enum(["pending", "rejected", "fulfilled"])

export type RedemptionStatus = z.infer<typeof redemptionStatusSchema>
