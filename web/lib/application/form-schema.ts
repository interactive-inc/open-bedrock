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

/**
 * 任意の値（旧 schema_json から読み込んだ unknown）を FormSchema に正規化する。
 * 失敗時は空スキーマを返す（旧データとの互換のため throw しない）。
 */
export function toFormSchema(raw: unknown): FormSchema {
  const parsed = formSchemaSchema.safeParse(raw)

  if (parsed.success) {
    return parsed.data
  }

  return emptySchema
}

export function emptyFormSchema(): FormSchema {
  return emptySchema
}

export function toFormFieldTypeLabel(type: FormFieldType): string {
  if (type === "text") return "1行テキスト"

  if (type === "textarea") return "複数行テキスト"

  if (type === "number") return "数値"

  if (type === "date") return "日付"

  return "選択肢"
}
