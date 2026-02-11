<script lang="ts" setup>
const model = defineModel<string>();
</script>

<template>
  <v-card class="pa-4 mb-4" elevation="2">
    <v-text-field
      v-model="model"
      label="Search Items"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      placeholder="Search by title, description, or status..."
      clearable
      hide-details
    />
  </v-card>
</template>
