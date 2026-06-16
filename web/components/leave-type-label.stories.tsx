import type { Meta, StoryObj } from "@storybook/react-vite"
import { LeaveTypeLabel } from "@/components/leave-type-label"

const meta = {
  title: "components/LeaveTypeLabel",
  component: LeaveTypeLabel,
} satisfies Meta<typeof LeaveTypeLabel>

export default meta

type Story = StoryObj<typeof meta>

export const Annual: Story = {
  args: { leaveType: "annual" },
}

export const Special: Story = {
  args: { leaveType: "special" },
}
