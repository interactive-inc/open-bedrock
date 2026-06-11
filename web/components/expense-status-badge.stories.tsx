import type { Meta, StoryObj } from "@storybook/nextjs"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"

const meta = {
  title: "components/ExpenseStatusBadge",
  component: ExpenseStatusBadge,
} satisfies Meta<typeof ExpenseStatusBadge>

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

export const Settled: Story = {
  args: { status: "settled" },
}
