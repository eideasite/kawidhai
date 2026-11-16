<script setup>
import { ref } from 'vue'
import { Search } from 'lucide-vue-next'

defineProps({
  label: {
    type: String,
    required: true,
  },
})

const query = ref('')

function searchGoogleAi() {
  const searchQuery = query.value.trim()
  if (!searchQuery) return
  window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank', 'noopener,noreferrer')
  query.value = ''
}
</script>

<template>
  <form
    class="header-search"
    role="search"
    @submit.prevent="searchGoogleAi"
  >
    <Search
      :size="18"
      aria-hidden="true"
    />
    <input
      v-model="query"
      :aria-label="label"
      :placeholder="label"
    >
    <button
      class="search-submit"
      type="submit"
    >
      Google AI
    </button>
  </form>
</template>
