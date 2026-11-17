<script setup>
import { ChevronRight, ImagePlus } from 'lucide-vue-next'
import { translate } from '../../i18n.js'

const props = defineProps({
  collections: {
    type: Array,
    required: true,
  },
  articles: {
    type: Array,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['open-manager', 'edit-collection', 'open-article'])
const t = (text) => translate(text, props.language)

function openHighlight(articleId) {
  const article = props.articles.find((item) => item.id === articleId) || { id: articleId }
  emit('open-article', article)
}
</script>

<template>
  <section class="content-section home-highlights-section">
    <div class="section-title-row">
      <h2>{{ t('Highlights') }}</h2>
    </div>
    <article
      v-for="collection in collections"
      :key="collection.id"
      class="surface-card highlight-collection-card"
    >
      <button
        class="highlight-collection-preview"
        type="button"
        :aria-label="`${t('Edit highlights')}: ${collection.title}`"
        @click="emit('edit-collection', collection)"
      >
        <span
          v-if="collection.items.length"
          class="highlight-collection-cover"
        >
          <img
            :src="collection.items[0].src"
            :alt="collection.items[0].name || t('Highlight image')"
          >
        </span>
        <span
          v-else
          class="highlight-collection-cover highlight-collection-cover-empty"
          aria-hidden="true"
        >
          <ImagePlus :size="20" />
        </span>
        <span class="highlight-collection-preview-copy">
          <strong>{{ collection.title }}</strong>
          <small v-if="collection.items.length">{{ collection.items.length }} {{ t('Photos') }}</small>
          <small v-else>{{ (collection.articleHighlights || []).length }} {{ t('Saved quotes') }}</small>
        </span>
        <ChevronRight
          :size="17"
          aria-hidden="true"
        />
      </button>
      <button
        v-for="highlight in collection.articleHighlights || []"
        :key="highlight.id"
        class="highlight-quote"
        type="button"
        @click="openHighlight(highlight.articleId)"
      >
        <span>{{ highlight.text }}</span><small>{{ highlight.articleTitle }}</small>
      </button>
    </article>
    <p
      v-if="!collections.length"
      class="empty-state"
    >
      {{ t('Add photos to create your first highlight.') }}
    </p>
    <button
      class="button button-secondary highlight-manager-trigger"
      type="button"
      @click="emit('open-manager')"
    >
      {{ t('Edit highlights') }}
    </button>
  </section>
</template>
