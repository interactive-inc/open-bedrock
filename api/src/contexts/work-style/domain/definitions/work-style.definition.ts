import { z } from "zod"

export const workStyleSchema = z.enum(["regular", "flextime", "discretionary", "shift"])

export type WorkStyle = z.infer<typeof workStyleSchema>
