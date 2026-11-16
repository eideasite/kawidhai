<script setup>
import { computed } from 'vue'

const props = defineProps({
  profile: { type: Object, required: true },
  size: { type: String, default: 'normal' },
})

const isImage = computed(() => typeof props.profile.avatar === 'string' && props.profile.avatar.startsWith('data:image/'))
const avatarLabel = computed(() => {
  const avatar = props.profile.avatar
  return typeof avatar === 'string' && avatar && !isImage.value
    ? avatar
    : props.profile.name?.trim().slice(0, 1) || 'J'
})
</script>

<template>
  <span
    class="profile-avatar"
    :class="size"
    aria-hidden="true"
  >
    <img
      v-if="isImage"
      :src="profile.avatar"
      alt=""
    >
    <template v-else>{{ avatarLabel }}</template>
  </span>
</template>
