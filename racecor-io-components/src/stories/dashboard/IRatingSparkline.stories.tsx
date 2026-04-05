import type { Meta, StoryObj } from '@storybook/react'
import IRatingSparkline from '@web/app/drive/dashboard/IRatingSparkline'

const meta: Meta<typeof IRatingSparkline> = {
  title: 'Dashboard/IRatingSparkline',
  component: IRatingSparkline,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof IRatingSparkline>

export const Uptrend: Story = {
  args: { values: [1850, 1870, 1865, 1890, 1920, 1945, 1960, 1980, 2010, 2035] },
}

export const Downtrend: Story = {
  args: { values: [2200, 2180, 2150, 2120, 2090, 2060, 2040, 2010, 1990, 1970] },
}

export const Flat: Story = {
  args: { values: [1500, 1510, 1505, 1498, 1502, 1508, 1503, 1500, 1505, 1501] },
}

export const Volatile: Story = {
  args: { values: [1800, 1900, 1750, 1950, 1700, 2000, 1850, 1950, 1800, 1900] },
}

export const FewPoints: Story = {
  args: { values: [1500, 1600, 1550] },
}

export const MultipleSparklines: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)] w-12">Road</span>
        <IRatingSparkline values={[1850, 1870, 1890, 1920, 1960, 2010]} />
        <span className="text-xs text-[var(--green)] font-mono">2010</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)] w-12">Oval</span>
        <IRatingSparkline values={[1500, 1480, 1460, 1440, 1420, 1400]} />
        <span className="text-xs text-red-400 font-mono">1400</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)] w-12">Dirt</span>
        <IRatingSparkline values={[1200, 1210, 1205, 1208, 1202, 1206]} />
        <span className="text-xs text-[var(--text-dim)] font-mono">1206</span>
      </div>
    </div>
  ),
}
