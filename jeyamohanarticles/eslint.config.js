import js from '@eslint/js'
import globals from 'globals'
import vue from 'eslint-plugin-vue'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
