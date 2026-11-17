<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import LoadingDots from './LoadingDots.vue'
import AiProviderPicker from './AiProviderPicker.vue'
import { AI_PROVIDERS, aiSearchQuery, openAiProviderTabs } from '../../services/aiSearch.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  errorLabel: {
    type: String,
    required: true,
  },
  loadingLabel: {
    type: String,
    required: true,
  },
  singleLoadingLabel: {
    type: String,
    required: true,
  },
  successLabel: {
    type: String,
    required: true,
  },
  singleSuccessLabel: {
    type: String,
    required: true,
  },
  singleErrorLabel: {
    type: String,
    required: true,
  },
  pickerTitle: {
    type: String,
    required: true,
  },
  pickerDescription: {
    type: String,
    required: true,
  },
  cancelLabel: {
    type: String,
    required: true,
  },
  submitLabel: {
    type: String,
    required: true,
  },
  mobileSubmitLabel: {
    type: String,
    required: true,
  },
})

const query = aiSearchQuery
const searching = ref(false)
const searchingSingle = ref(false)
const searchError = ref('')
const searchStatus = ref('')
const providerPickerOpen = ref(false)
const mobileViewport = ref(window.matchMedia('(max-width: 700px)').matches)
const mobileViewportQuery = window.matchMedia('(max-width: 700px)')

function updateMobileViewport() {
  mobileViewport.value = mobileViewportQuery.matches
}

onMounted(() => mobileViewportQuery.addEventListener('change', updateMobileViewport))
onUnmounted(() => mobileViewportQuery.removeEventListener('change', updateMobileViewport))

async function searchGoogleAi(provider) {
  if (searching.value) return
  const searchQuery = query.value
  if (!searchQuery.trim()) return

  providerPickerOpen.value = false
  searching.value = true
  searchingSingle.value = Boolean(provider)
  searchError.value = ''
  searchStatus.value = ''
  try {
    await openAiProviderTabs(searchQuery, provider ? [provider] : AI_PROVIDERS)
    query.value = ''
    searchStatus.value = provider
      ? props.singleSuccessLabel.replace('{provider}', provider.name)
      : props.successLabel
  } catch {
    searchError.value = provider ? props.singleErrorLabel : props.errorLabel
  } finally {
    searching.value = false
    searchingSingle.value = false
  }
}

function submitSearch() {
  if (!query.value.trim() || searching.value) return
  if (window.matchMedia('(max-width: 700px)').matches) {
    providerPickerOpen.value = true
    return
  }
  searchGoogleAi()
}
</script>

<template>
  <form
    v-bind="$attrs"
    class="header-search"
    role="search"
    :aria-busy="searching"
    @submit.prevent="submitSearch"
  >
    <Search
      :size="18"
      aria-hidden="true"
    />
    <input
      v-model="query"
      :aria-label="props.label"
      :placeholder="props.label"
      :disabled="searching"
    >
    <button
      class="search-submit ai-hover-button"
      type="submit"
      :disabled="searching || !query.trim()"
    >
      <template v-if="searching">
        {{ searchingSingle ? props.singleLoadingLabel : props.loadingLabel }}
        <LoadingDots />
      </template>
      <template v-else>
        {{ mobileViewport ? props.mobileSubmitLabel : props.submitLabel }}
      </template>
    </button>
    <span
      v-if="searchError || searchStatus"
      class="header-search-message"
      :class="{ 'has-error': searchError }"
      :role="searchError ? 'alert' : 'status'"
    >
      {{ searchError || searchStatus }}
    </span>
  </form>
  <AiProviderPicker
    v-if="providerPickerOpen"
    :providers="AI_PROVIDERS"
    :title="props.pickerTitle"
    :description="props.pickerDescription"
    :cancel-label="props.cancelLabel"
    @select="searchGoogleAi"
    @cancel="providerPickerOpen = false"
  />
</template>
