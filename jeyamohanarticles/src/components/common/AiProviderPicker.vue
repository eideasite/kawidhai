<script setup>
import { onMounted, ref } from 'vue'

defineProps({
  providers: {
    type: Array,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  cancelLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['select', 'cancel'])
const dialog = ref(null)

onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog
    ref="dialog"
    class="ai-provider-picker"
    aria-labelledby="ai-provider-picker-title"
    @cancel="emit('cancel')"
  >
    <h2 id="ai-provider-picker-title">
      {{ title }}
    </h2>
    <p>{{ description }}</p>
    <div class="ai-provider-picker-options">
      <button
        v-for="(provider, index) in providers"
        :key="provider.name"
        class="button button-secondary ai-hover-button"
        type="button"
        :autofocus="index === 0"
        @click="emit('select', provider)"
      >
        {{ provider.name }}
      </button>
    </div>
    <button
      class="text-button ai-provider-picker-cancel"
      type="button"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
  </dialog>
</template>
