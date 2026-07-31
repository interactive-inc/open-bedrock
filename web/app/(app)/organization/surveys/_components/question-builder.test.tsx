import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { QuestionBuilder } from "@/app/(app)/organization/surveys/_components/question-builder"

afterEach(cleanup)

const initialQuestions = [
  { id: "q1", type: "text", text: "今期の手応えは？" },
  { id: "q2", type: "scale", text: "働きやすさの満足度" },
]

function toHiddenValue(container: HTMLElement) {
  const input = container.querySelector('input[name="questions_json"]')

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("hidden input が見つからない")
  }

  return input.value
}

describe("QuestionBuilder", () => {
  test("reorders questions with the keyboard", () => {
    const rendered = render(<QuestionBuilder initialQuestions={initialQuestions} />)

    fireEvent.keyDown(screen.getByRole("button", { name: "設問1を並べ替え（上下キーで移動）" }), {
      key: "ArrowDown",
    })

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify([
        { id: "q2", type: "scale", text: "働きやすさの満足度", min: 1, max: 5 },
        { id: "q1", type: "text", text: "今期の手応えは？" },
      ]),
    )
  })

  test("keeps the order when the last question is moved down", () => {
    const rendered = render(<QuestionBuilder initialQuestions={initialQuestions} />)

    fireEvent.keyDown(screen.getByRole("button", { name: "設問2を並べ替え（上下キーで移動）" }), {
      key: "ArrowDown",
    })

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify([
        { id: "q1", type: "text", text: "今期の手応えは？" },
        { id: "q2", type: "scale", text: "働きやすさの満足度", min: 1, max: 5 },
      ]),
    )
  })
})
