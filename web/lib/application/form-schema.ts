import { z } from "zod"

/**
 * 申請テンプレートの入力項目スキーマ。Google フォーム的に項目を可変に持つため、
 * `fields` 配列に1項目ずつ定義を並べる。`schema_json` カラムに JSON で保存する。
 */
export const formFieldTypeSchema = z.enum(["text", "textarea", "number", "date", "select"])

export type FormFieldType = z.infer<typeof formFieldTypeSchema>

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: formFieldTypeSchema,
  required: z.boolean(),
  description: z.string().nullable(),
  options: z.array(z.string()).nullable(),
})

export type FormField = z.infer<typeof formFieldSchema>

export const formSchemaSchema = z.object({
  fields: z.array(formFieldSchema),
})

export type FormSchema = z.infer<typeof formSchemaSchema>

const emptySchema: FormSchema = { fields: [] }

const legacyPropertySchema = z
  .object({
    type: z.enum(["string", "number", "integer"]),
    format: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
  })
  .passthrough()

const legacyObjectSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(z.string(), legacyPropertySchema),
    required: z.array(z.string()).optional(),
  })
  .passthrough()

/**
 * 任意の値（旧 schema_json から読み込んだ unknown）を FormSchema に正規化する。
 * 失敗時は空スキーマを返す（旧データとの互換のため throw しない）。
 */
export function toFormSchema(raw: unknown): FormSchema {
  const parsed = formSchemaSchema.safeParse(raw)

  if (parsed.success) {
    return parsed.data
  }

  const legacy = legacyObjectSchema.safeParse(raw)

  if (legacy.success) {
    const required = new Set(legacy.data.required ?? [])

    return {
      fields: Object.entries(legacy.data.properties).map(([id, property]) => {
        const options = property.enum ?? null
        const type: FormFieldType =
          options !== null
            ? "select"
            : property.type === "number" || property.type === "integer"
              ? "number"
              : property.format === "date"
                ? "date"
                : "text"

        return {
          id,
          label: property.title?.trim() || id,
          type,
          required: required.has(id),
          description: property.description ?? null,
          options: type === "select" ? options : null,
        }
      }),
    }
  }

  return emptySchema
}
