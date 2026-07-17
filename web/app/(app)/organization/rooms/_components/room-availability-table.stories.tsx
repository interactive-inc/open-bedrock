import type { Meta, StoryObj } from "@storybook/react-vite"
import { RoomAvailabilityTable } from "@/app/(app)/organization/rooms/_components/room-availability-table"

const meta = {
  title: "rooms/RoomAvailabilityTable",
  component: RoomAvailabilityTable,
} satisfies Meta<typeof RoomAvailabilityTable>

export default meta

type Story = StoryObj<typeof meta>

export const MixedAvailability: Story = {
  args: {
    availabilities: [
      {
        room: { id: 1, name: "Meeting Room A", capacity: 8 },
        available: true,
        conflicts: [],
      },
      {
        room: { id: 2, name: "Meeting Room B", capacity: 4 },
        available: false,
        conflicts: [{ purpose: "Weekly standup" }],
      },
      {
        room: { id: 3, name: "Conference Hall", capacity: 20 },
        available: false,
        conflicts: [{ purpose: "Board meeting" }, { purpose: null }],
      },
    ],
  },
}

export const AllAvailable: Story = {
  args: {
    availabilities: [
      {
        room: { id: 1, name: "Room Alpha", capacity: 6 },
        available: true,
        conflicts: [],
      },
      {
        room: { id: 2, name: "Room Beta", capacity: 10 },
        available: true,
        conflicts: [],
      },
    ],
  },
}
