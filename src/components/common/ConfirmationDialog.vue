<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'primary',
  loading: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('update:modelValue', false)
  emit('cancel')
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
      <v-card-title class="text-h6 font-weight-bold">
        {{ title }}
      </v-card-title>

      <v-card-text class="pb-0">
        {{ message }}
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />

        <v-btn
          variant="text"
          color="grey"
          @click="handleCancel"
          :disabled="loading"
        >
          {{ cancelText }}
        </v-btn>

        <v-btn
          :color="confirmColor"
          variant="elevated"
          @click="handleConfirm"
          :loading="loading"
        >
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
