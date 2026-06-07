import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { darkTheme, lightTheme, enUS, jaJP, ruRU, zhCN, type GlobalTheme, type NLocale } from 'naive-ui'
import { TRANSLATIONS, type Language, type TranslationKey } from '@/i18n/translations'

const THEME_STORAGE_KEY = 'theme'
const LOCALE_STORAGE_KEY = 'locale'

function resolveLanguage(value: string | null): Language {
  if (value === 'en' || value === 'ja' || value === 'ru') return value
  return 'zh'
}

function getNaiveLocale(value: Language): NLocale {
  if (value === 'en') return enUS
  if (value === 'ja') return jaJP
  if (value === 'ru') return ruRU
  return zhCN
}

export const useSettingsStore = defineStore('settings', () => {
  const isDark = ref(localStorage.getItem(THEME_STORAGE_KEY) !== 'light')
  const theme = ref<GlobalTheme>(isDark.value ? darkTheme : lightTheme)
  const language = ref<Language>(resolveLanguage(localStorage.getItem(LOCALE_STORAGE_KEY)))
  const locale = ref<NLocale>(getNaiveLocale(language.value))

  watch(isDark, (val) => {
    theme.value = val ? darkTheme : lightTheme
    localStorage.setItem(THEME_STORAGE_KEY, val ? 'dark' : 'light')
  })

  watch(language, (val) => {
    locale.value = getNaiveLocale(val)
    localStorage.setItem(LOCALE_STORAGE_KEY, val)
  })

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  function t(key: TranslationKey): string {
    return TRANSLATIONS[language.value][key]
  }

  return { isDark, theme, language, locale, toggleTheme, t }
})
