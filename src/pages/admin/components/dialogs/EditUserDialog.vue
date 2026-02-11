<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useUserRolesStore } from '@/stores/roles'

interface User {
  id: string
  email?: string
  created_at?: string
  raw_user_meta_data?: Record<string, any>
  raw_app_meta_data?: Record<string, any>
}

interface EditUserData {
  full_name?: string
  role?: number
  [key: string]: any
}

interface Props {
  modelValue: boolean
  user: User | null
  editForm: EditUserData
  loading: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:editForm', value: EditUserData): void
  (e: 'save'): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Initialize roles store
const rolesStore = useUserRolesStore()

// Fetch roles on component mount
onMounted(async () => {
  if (rolesStore.roles.length === 0) {
    await rolesStore.fetchRoles()
  }
})

// Computed properties for v-model
const dialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const form = computed({
  get: () => props.editForm,
  set: (value: EditUserData) => emit('update:editForm', value)
})

// Role options from store
const roleOptions = computed(() => {
  return rolesStore.roles.map(role => ({
    title: role.title,
    value: role.id
  }))
})

// Helper functions for role display
const getRoleIcon = (roleValue: number) => {
  // Get role from store to determine appropriate icon
  const role = rolesStore.roles.find(r => r.id === roleValue)
  if (!role) return 'mdi-account-question'

  // Basic mapping based on common role titles
  const title = role.title.toLowerCase()
  if (title.includes('admin')) return 'mdi-shield-crown'
  if (title.includes('student')) return 'mdi-school'
  if (title.includes('faculty') || title.includes('teacher')) return 'mdi-account-tie'
  return 'mdi-account' // Default for other roles
}

const getRoleDescription = (roleValue: number) => {
  const role = rolesStore.roles.find(r => r.id === roleValue)
  if (!role) return 'Unknown role'

  // You can customize descriptions based on role titles
  const title = role.title.toLowerCase()
  if (title.includes('admin')) return 'Full administrator access'
  if (title.includes('student')) return 'Student access'
  if (title.includes('faculty') || title.includes('teacher')) return 'Faculty access'
  return `${role.title} access` // Default description
}

const getCurrentRoleName = (roleValue: number | undefined) => {
  if (!roleValue) return 'No Role'
  const role = rolesStore.roles.find(r => r.id === roleValue)
  return role ? role.title : 'Unknown Role'
}

// Form validation
const isFormValid = computed(() => {
  return form.value.full_name &&
         form.value.full_name.trim().length > 0 &&
         form.value.role &&
         rolesStore.roles.some(role => role.id === form.value.role)
})

// Handle save
const handleSave = () => {
  if (isFormValid.value) {
    emit('save')
  }
}

// Handle cancel
const handleCancel = () => {
  emit('cancel')
}

// Watch for dialog close to emit cancel
watch(dialog, (newValue) => {
  if (!newValue) {
    handleCancel()
  }
})
</script>

<template>
  <v-dialog
    v-model="dialog"
    max-width="500px"
    persistent
  >
    <v-card>
      <v-card-title class="text-h5 pa-4">
        <v-icon class="me-2">mdi-account-edit</v-icon>
        Edit User
      </v-card-title>

      <v-card-text class="pa-4">
        <v-form @submit.prevent="handleSave">
          <!-- User Info Display -->
          <div class="mb-4">
            <div class="text-subtitle-2 text-medium-emphasis mb-2">
              User Information
            </div>
            <div class="d-flex align-center">
              <v-avatar size="40" class="me-3">
                <v-icon>mdi-account</v-icon>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ props.user?.email }}</div>
                <div class="text-caption text-medium-emphasis">
                  User ID: {{ props.user?.id }}
                </div>
              </div>
            </div>
          </div>

          <v-divider class="mb-4"></v-divider>

          <!-- Full Name Field -->
          <v-text-field
            v-model="form.full_name"
            label="Full Name"
            variant="outlined"
            density="comfortable"
            :rules="[
              v => !!v || 'Full name is required',
              v => (v && v.length >= 2) || 'Full name must be at least 2 characters'
            ]"
            class="mb-3"
            prepend-inner-icon="mdi-account"
          />

          <!-- Role Field -->
          <v-select
            v-model="form.role"
            :items="roleOptions"
            item-title="title"
            item-value="value"
            label="Role"
            variant="outlined"
            density="comfortable"
            :rules="[v => !!v || 'Role is required']"
            :loading="rolesStore.loading"
            :disabled="rolesStore.loading || roleOptions.length === 0"
            class="mb-3"
            prepend-inner-icon="mdi-shield-account"
          >
            <template v-slot:item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :prepend-icon="getRoleIcon(item.raw.value)"
              >
                <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ getRoleDescription(item.raw.value) }}
                </v-list-item-subtitle>
              </v-list-item>
            </template>
            <template v-slot:no-data>
              <div class="pa-4 text-center text-medium-emphasis">
                {{ rolesStore.loading ? 'Loading roles...' : 'No roles available' }}
              </div>
            </template>
          </v-select>

          <!-- Current Role Display -->
          <v-alert
            v-if="props.user"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            <template v-slot:prepend>
              <v-icon>mdi-information</v-icon>
            </template>
            Current role: {{ getCurrentRoleName(props.user.raw_user_meta_data?.role || props.user.raw_app_meta_data?.role) }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>

        <v-btn
          color="grey"
          variant="text"
          @click="handleCancel"
          :disabled="props.loading"
        >
          Cancel
        </v-btn>

        <v-btn
          color="primary"
          variant="elevated"
          @click="handleSave"
          :loading="props.loading"
          :disabled="!isFormValid"
        >
          <v-icon start>mdi-content-save</v-icon>
          Save Changes
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-card-title {
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
