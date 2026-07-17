import type { Meta, StoryObj } from "@storybook/react-vite"
import { SkillSearchForm } from "@/app/(app)/organization/skills/_components/skill-search-form"

const meta = {
  title: "skills/SkillSearchForm",
  component: SkillSearchForm,
} satisfies Meta<typeof SkillSearchForm>

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
    q: "TypeScript",
    category: "programming",
  },
}
