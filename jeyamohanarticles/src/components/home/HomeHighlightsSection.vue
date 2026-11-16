<script setup>
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

const emit = defineEmits(['add-collection', 'update-title', 'open-article'])
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
      <button
        class="text-button"
        type="button"
        @click="emit('add-collection')"
      >
        {{ t('Add collection') }}
      </button>
    </div>
    <article
      v-for="collection in collections"
      :key="collection.id"
      class="surface-card highlight-collection-card"
    >
      <input
        class="highlight-collection-title"
        :value="collection.title"
        :aria-label="t('Collection title')"
        maxlength="80"
        @change="emit('update-title', collection.id, $event.target.value.trim() || collection.title)"
      >
      <div
        v-if="collection.items.length"
        class="highlight-collection-images"
      >
        <img
          v-for="image in collection.items"
          :key="image.id"
          :src="image.src"
          :alt="image.name || t('Highlight image')"
        >
      </div>
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
      {{ t('Add a collection to keep article images and quotes together.') }}
    </p>
  </section>
</template>
