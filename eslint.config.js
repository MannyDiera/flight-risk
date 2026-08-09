import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import vueTsEslintConfig from '@vue/eslint-config-typescript'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/coverage/**'],
  },
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),
])
