import type { StorybookConfig } from '@storybook/react-vite'
import path from 'path'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react-vite',
  staticDirs: ['../../web/public'],
  viteFinal: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      // Allow importing from the web app: import { GameBadge } from '@web/app/drive/admin/components'
      '@web': path.resolve(__dirname, '../../web/src'),
    }
    return config
  },
}

export default config
