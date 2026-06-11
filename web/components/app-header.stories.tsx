import type { Meta, StoryObj } from "@storybook/nextjs"
import { fn } from "@storybook/test"
import { AppHeader } from "@/components/app-header"

const meta = {
  title: "components/AppHeader",
  component: AppHeader,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentUser: {
      id: 1,
      code: "EMP001",
      name: "Taro Yamada",
      email: "taro@example.com",
      role: "admin",
      dept_name: "Engineering",
      position: "Senior Engineer",
    },
    onLogout: fn(),
  },
}

export const NoDepartment: Story = {
  args: {
    currentUser: {
      id: 2,
      code: "EMP002",
      name: "Hanako Sato",
      email: "hanako@example.com",
      role: "member",
      dept_name: null,
      position: null,
    },
    onLogout: fn(),
  },
}
