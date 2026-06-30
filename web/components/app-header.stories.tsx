import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
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
      permissions: ["notification:view"],
      role_keys: ["admin"],
    },
    onLogout: fn(),
    unreadNotificationCount: 3,
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
      permissions: [],
      role_keys: ["member"],
    },
    onLogout: fn(),
    unreadNotificationCount: 0,
  },
}
