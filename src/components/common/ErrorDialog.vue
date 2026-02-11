<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  message?: string
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Error',
  message: 'An error occurred. Please try again.',
  buttonText: 'OK'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleClose = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="400"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6 font-weight-bold d-flex align-center">
        <v-icon color="error" class="me-2">mdi-alert-circle</v-icon>
        {{ title }}
      </v-card-title>

      <v-card-text class="pb-0">
        {{ message }}
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />

        <v-btn
          color="primary"
          variant="elevated"
          @click="handleClose"
        >
          {{ buttonText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
