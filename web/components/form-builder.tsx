"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { EmptyState } from "@/components/empty-state"
import { ReorderableItem } from "@/components/reorderable-item"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FormField, FormFieldType, FormSchema } from "@/lib/application/form-schema"
import { emptyFormSchema } from "@/lib/application/empty-form-schema"
import { toFormFieldTypeLabel } from "@/lib/application/to-form-field-type-label"
import { withMovedItem } from "@/lib/array/with-moved-item"

/**
 * Google フォーム風のフォームビルダー。項目をユーザーが追加・削除・編集して並べ、
 * 結果を JSON 文字列として hidden input に出力する。Server Action 側はその JSON を保存する。
 */
type Props = {
  name: string
  initialSchema?: FormSchema
}

const fieldTypes: ReadonlyArray<FormFieldType> = ["text", "textarea", "number", "date", "select"]

function createEmptyField(): FormField {
  const id = `field_${Math.floor(performance.now() * 1000)}`

  return {
    id,
    label: "新しい項目",
    type: "text",
    required: false,
    description: null,
    options: null,
  }
}

export function FormBuilder(props: Props) {
  const [schema, setSchema] = useState<FormSchema>(props.initialSchema ?? emptyFormSchema())

  function addField() {
    setSchema({ fields: [...schema.fields, createEmptyField()] })
  }

  function removeField(index: number) {
    setSchema({ fields: schema.fields.filter((_, i) => i !== index) })
  }

  function updateField(index: number, next: FormField) {
    setSchema({
      fields: schema.fields.map((field, i) => (i === index ? next : field)),
    })
  }

  function moveField(fromIndex: number, toIndex: number) {
    setSchema({ fields: [...withMovedItem(schema.fields, fromIndex, toIndex)] })
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={props.name} value={JSON.stringify(schema)} />

      {schema.fields.length === 0 ? (
        <EmptyState
          title="まだ項目がありません"
          description="「項目を追加」ボタンから入力欄を作っていきます。"
          action={
            <Button type="button" onClick={addField}>
              <Plus />
              項目を追加
            </Button>
          }
        />
      ) : null}

      {schema.fields.map((field, index) => (
        <ReorderableItem
          key={field.id}
          index={index}
          dragHandleLabel={`項目 ${index + 1} を並べ替え（上下キーで移動）`}
          onMove={moveField}
        >
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>項目 {index + 1}</span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`項目 ${index + 1} を削除`}
                  onClick={() => removeField(index)}
                >
                  <Trash2 />
                </Button>
              </CardTitle>

              <CardDescription>{toFormFieldTypeLabel(field.type)}</CardDescription>
            </CardHeader>

            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${field.id}-label`}>ラベル</FieldLabel>

                  <Input
                    id={`${field.id}-label`}
                    value={field.label}
                    onChange={(event) =>
                      updateField(index, { ...field, label: event.target.value })
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${field.id}-type`}>項目の種類</FieldLabel>

                  <NativeSelect
                    id={`${field.id}-type`}
                    value={field.type}
                    className="w-full"
                    onChange={(event) => {
                      const nextType = event.target.value as FormFieldType

                      updateField(index, {
                        ...field,
                        type: nextType,
                        options: nextType === "select" ? (field.options ?? [""]) : null,
                      })
                    }}
                  >
                    {fieldTypes.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {toFormFieldTypeLabel(type)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${field.id}-description`}>説明（任意）</FieldLabel>

                  <Input
                    id={`${field.id}-description`}
                    value={field.description ?? ""}
                    placeholder="入力者向けの補足文"
                    onChange={(event) =>
                      updateField(index, {
                        ...field,
                        description: event.target.value === "" ? null : event.target.value,
                      })
                    }
                  />
                </Field>

                {field.type === "select" ? (
                  <Field>
                    <FieldLabel htmlFor={`${field.id}-options`}>選択肢（改行区切り）</FieldLabel>

                    <textarea
                      id={`${field.id}-options`}
                      value={(field.options ?? []).join("\n")}
                      onChange={(event) =>
                        updateField(index, {
                          ...field,
                          options: event.target.value.split("\n").filter((line) => line !== ""),
                        })
                      }
                      rows={3}
                      className="min-h-16 w-full rounded-2xl bg-input/50 px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    />

                    <FieldDescription>1行に1つの選択肢を書く</FieldDescription>
                  </Field>
                ) : null}

                <Field orientation="horizontal">
                  <input
                    id={`${field.id}-required`}
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateField(index, { ...field, required: event.target.checked })
                    }
                  />

                  <FieldLabel htmlFor={`${field.id}-required`}>必須にする</FieldLabel>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </ReorderableItem>
      ))}

      {schema.fields.length > 0 ? (
        <Button type="button" variant="outline" onClick={addField}>
          <Plus />
          項目を追加
        </Button>
      ) : null}
    </div>
  )
}
