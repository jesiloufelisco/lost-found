<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'error',
  loading: false
})

const emit = defineEmits<Emits>()

// Computed properties for v-model
const dialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

// Handle confirm
const handleConfirm = () => {
  emit('confirm')
}

// Handle cancel
const handleCancel = () => {
  emit('cancel')
}

// Get icon based on confirm color
const getIcon = computed(() => {
  switch (props.confirmColor) {
    case 'error':
      return 'mdi-alert-circle'
    case 'warning':
      return 'mdi-alert'
    case 'success':
      return 'mdi-check-circle'
    default:
      return 'mdi-help-circle'
  }
})
</script>

<template>
  <v-dialog
    v-model="dialog"
    max-width="400px"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6 pa-4 d-flex align-center">
        <v-icon
          :color="props.confirmColor"
          class="me-2"
          size="24"
        >
          {{ getIcon }}
        </v-icon>
        {{ props.title }}
      </v-card-title>

      <v-card-text class="pa-4">
        <p class="text-body-1 mb-0">
          {{ props.message }}
        </p>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>

        <v-btn
          color="grey"
          variant="text"
          @click="handleCancel"
          :disabled="props.loading"
        >
          {{ props.cancelText }}
        </v-btn>

        <v-btn
          :color="props.confirmColor"
          variant="elevated"
          @click="handleConfirm"
          :loading="props.loading"
        >
          {{ props.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
