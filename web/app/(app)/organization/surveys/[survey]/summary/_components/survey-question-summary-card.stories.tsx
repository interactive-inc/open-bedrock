import type { Meta, StoryObj } from "@storybook/react-vite"
import { SurveyQuestionSummaryCard } from "@/app/(app)/organization/surveys/[survey]/summary/_components/survey-question-summary-card"

const meta = {
  title: "surveys/SurveyQuestionSummaryCard",
  component: SurveyQuestionSummaryCard,
} satisfies Meta<typeof SurveyQuestionSummaryCard>

export default meta

type Story = StoryObj<typeof meta>

export const ScaleQuestion: Story = {
  args: {
    question: {
      id: "q1",
      title: "How satisfied are you with your work environment?",
      type: "scale",
      distribution: {
        "1": 2,
        "2": 5,
        "3": 12,
        "4": 18,
        "5": 8,
      },
      answers: [],
    },
  },
}

export const ChoiceQuestion: Story = {
  args: {
    question: {
      id: "q2",
      title: "Which department do you collaborate with most?",
      type: "choice",
      distribution: {
        Engineering: 15,
        Design: 8,
        Marketing: 5,
        Sales: 3,
      },
      answers: [],
    },
  },
}

export const TextQuestion: Story = {
  args: {
    question: {
      id: "q3",
      title: "Any additional feedback?",
      type: "text",
      distribution: {},
      answers: [
        "The remote work policy has been very helpful.",
        "Would appreciate more team-building events.",
        "Office snacks are great!",
      ],
    },
  },
}

export const EmptyResponses: Story = {
  args: {
    question: {
      id: "q4",
      title: "What improvements would you suggest?",
      type: "text",
      distribution: {},
      answers: [],
    },
  },
}
