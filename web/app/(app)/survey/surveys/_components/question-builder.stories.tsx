import type { Meta, StoryObj } from "@storybook/react-vite"
import { QuestionBuilder } from "@/app/(app)/survey/surveys/_components/question-builder"

const meta = {
  title: "QuestionBuilder",
  component: QuestionBuilder,
} satisfies Meta<typeof QuestionBuilder>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {},
  render: (args) => (
    <div className="w-[720px]">
      <QuestionBuilder {...args} />
    </div>
  ),
}

export const WithQuestions: Story = {
  args: {
    initialQuestions: [
      { id: "q1", type: "text", text: "今期に手応えのあった仕事は？" },
      { id: "q2", type: "scale", text: "働きやすさの満足度" },
      { id: "q3", type: "choice", text: "1on1 の頻度", options: ["月1回", "月2回", "週1回"] },
    ],
  },
  render: (args) => (
    <div className="w-[720px]">
      <QuestionBuilder {...args} />
    </div>
  ),
}
