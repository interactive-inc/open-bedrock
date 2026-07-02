"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Field, FieldLabel } from "@/components/ui/field"

type QuestionType = "scale" | "choice" | "text"

type Question = {
  id: string
  type: QuestionType
  text: string
  options: ReadonlyArray<string>
}

type Props = {
  initialQuestions?: ReadonlyArray<{
    id: string
    type: string
    text: string
    options?: ReadonlyArray<string>
  }>
}

const TYPE_LABELS: Record<QuestionType, string> = {
  text: "テキスト",
  scale: "5段階評価",
  choice: "選択式",
}

function toQuestionType(value: string): QuestionType {
  if (value === "scale" || value === "choice" || value === "text") {
    return value
  }

  return "text"
}

/**
 * サーベイの設問を GUI で組み立てる。hidden input に JSON 文字列を出力し、既存の form action と互換を保つ。
 */
export function QuestionBuilder(props: Props) {
  const initial: ReadonlyArray<Question> = (props.initialQuestions ?? []).map((q) => ({
    id: q.id,
    type: toQuestionType(q.type),
    text: q.text,
    options: q.options ?? [],
  }))

  const [questions, setQuestions] = useState<ReadonlyArray<Question>>(initial)

  function addQuestion() {
    const nextId = `q${questions.length + 1}`

    setQuestions([...questions, { id: nextId, type: "text", text: "", options: [] }])
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  function updateText(index: number, text: string) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, text } : q)))
  }

  function updateType(index: number, type: QuestionType) {
    setQuestions(
      questions.map((q, i) =>
        i === index ? { ...q, type, options: type === "choice" ? q.options : [] } : q,
      ),
    )
  }

  function updateOptions(index: number, raw: string) {
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")

    setQuestions(questions.map((q, i) => (i === index ? { ...q, options: parsed } : q)))
  }

  const jsonValue = JSON.stringify(
    questions.map((q) => {
      if (q.type === "scale") {
        return { id: q.id, type: q.type, text: q.text, min: 1, max: 5 }
      }

      if (q.type === "choice") {
        return { id: q.id, type: q.type, text: q.text, options: q.options }
      }

      return { id: q.id, type: q.type, text: q.text }
    }),
  )

  return (
    <Field>
      <FieldLabel>設問</FieldLabel>

      <input type="hidden" name="questions_json" value={jsonValue} />

      <div className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <div key={question.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{index + 1}</span>

              <Input
                value={question.text}
                onChange={(e) => updateText(index, e.target.value)}
                placeholder="設問のテキスト"
                className="flex-1"
                required
              />

              <NativeSelect
                value={question.type}
                onChange={(e) => updateType(index, toQuestionType(e.target.value))}
                className="w-32"
              >
                {(Object.keys(TYPE_LABELS) as ReadonlyArray<QuestionType>).map((key) => (
                  <NativeSelectOption key={key} value={key}>
                    {TYPE_LABELS[key]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(index)}
                aria-label={`設問${index + 1}を削除`}
              >
                削除
              </Button>
            </div>

            {question.type === "choice" ? (
              <Input
                value={question.options.join(", ")}
                onChange={(e) => updateOptions(index, e.target.value)}
                placeholder="選択肢をカンマ区切りで入力（例: 月1回, 月2回, 週1回）"
                className="text-sm"
              />
            ) : null}
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addQuestion} className="self-start">
          + 設問を追加
        </Button>
      </div>
    </Field>
  )
}
