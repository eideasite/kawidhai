<template>
  <span
    class="loading-dots"
    aria-hidden="true"
  >
    <span
      v-for="dot in 4"
      :key="dot"
    />
  </span>
</template>
