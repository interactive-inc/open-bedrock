import type { Meta, StoryObj } from "@storybook/react-vite"
import { LeaveStatusBadge } from "@/components/leave-status-badge"

const meta = {
  title: "components/LeaveStatusBadge",
  component: LeaveStatusBadge,
} satisfies Meta<typeof LeaveStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Pending: Story = {
  args: { status: "pending" },
}

export const Approved: Story = {
  args: { status: "approved" },
}

export const Rejected: Story = {
  args: { status: "rejected" },
}
