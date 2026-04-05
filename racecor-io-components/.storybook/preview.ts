import type { Preview } from '@storybook/react'
import '../../web/src/styles/globals.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'k10-dark',
      values: [
        { name: 'k10-dark', value: '#0a0a14' },
        { name: 'k10-surface', value: 'rgb(16, 16, 32)' },
        { name: 'white', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
