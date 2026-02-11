<script lang="ts" setup>
type NewItemForm = {
  title: string;
  description: string;
}

type Props = {
  posting: boolean;
  form: NewItemForm;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{
  submit: [item: NewItemForm & { status: 'lost' }];
}>();

const handleSubmit = () => {
  if (props.form.title && props.form.description) {
    emit("submit", {
      ...props.form,
      status: 'lost'
    });
  }
};
</script>

<template>
  <v-dialog v-model="model" max-width="600">
    <v-card>
      <v-card-title class="text-h5 font-weight-bold">
        <v-icon class="me-2">mdi-plus-circle</v-icon>
        Post Lost Item
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="handleSubmit">
          <v-text-field
            v-model="form.title"
            label="Item Title"
            prepend-inner-icon="mdi-text"
            variant="outlined"
            placeholder="e.g., iPhone 13, Blue Backpack, Student ID"
            class="mb-3"
          />

          <v-textarea
            v-model="form.description"
            label="Location"
            prepend-inner-icon="mdi-text-long"
            variant="outlined"
            placeholder="Location where the item was lost"
            rows="4"
          />

          <v-alert type="info" variant="tonal" class="mt-3">
            <template #prepend>
              <v-icon>mdi-chat</v-icon>
            </template>
            Students can start a realtime chat to describe this item for
            ownership verification.
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="model = false" :disabled="posting">
          Cancel
        </v-btn>
        <v-btn
          color="success"
          @click="handleSubmit"
          :loading="posting"
          :disabled="!form.title || !form.description"
        >
          Post Item
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
