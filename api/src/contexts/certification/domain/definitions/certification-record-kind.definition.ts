import { z } from "zod"

export const certificationRecordKinds = [
  "certification-record",
  "employee-certification-record",
] as const

export const certificationRecordKindSchema = z.enum(certificationRecordKinds)
export type CertificationRecordKind = z.infer<typeof certificationRecordKindSchema>
