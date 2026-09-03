import type { Meta, StoryObj } from "@storybook/react-vite"
import { KnowledgeSearchForm } from "@/app/(app)/knowledge/knowledge-articles/_components/knowledge-search-form"

const meta = {
  title: "knowledge/KnowledgeSearchForm",
  component: KnowledgeSearchForm,
} satisfies Meta<typeof KnowledgeSearchForm>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    q: null,
    category: null,
  },
}

export const WithSearchTerm: Story = {
  args: {
    q: "onboarding",
    category: "guide",
  },
}
