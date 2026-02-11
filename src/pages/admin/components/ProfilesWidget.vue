
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProfilesWidget } from './composables/profilesWidget'
import { useUserRolesStore } from '@/stores/roles'
import { getEmailInitials } from '@/utils/helpers'

// Emits for parent component interactions
const emit = defineEmits<{
  'edit-profile': []
  'view-permissions': []
  'profile-updated': [data: Record<string, any>]
}>()

// Use the composables
const {
  currentUser,
  loading,
  error,
  userDisplayName,
  userEmail,
  userRole,
  userCreatedAt,
  hasUserData,
  fetchCurrentUser,
  refreshUserData,
  updateUserMetadata
} = useProfilesWidget()

const rolesStore = useUserRolesStore()

// Computed property to get role description
const roleDescription = computed(() => {
  if (!userRole.value) return null
  const role = rolesStore.roles.find(r => r.id === userRole.value)
  return role?.title || `Role ID: ${userRole.value}`
})

// Computed property for email initials
const userInitials = computed(() => {
  return getEmailInitials(userEmail.value)
})

// Load roles on component mount
onMounted(async () => {
  await rolesStore.fetchRoles()
})

// Form state
const showUpdateForm = ref(false)
const updateForm = ref({
  student_number: '',
  organization_id: null as number | null,
  status: 'active'
})

// Status options
const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Blocked', value: 'blocked' }
]

// Toggle update form
const toggleUpdateForm = () => {
  showUpdateForm.value = !showUpdateForm.value

  // Reset form when opening
  if (showUpdateForm.value) {
    updateForm.value = {
      student_number: currentUser.value?.user_metadata?.student_number || '',
      organization_id: currentUser.value?.user_metadata?.organization_id || null,
      status: currentUser.value?.user_metadata?.status || 'active'
    }
  }
}

// Handle profile update
const handleUpdateProfile = async () => {
  // Prepare the data to update
  const additionalData = {
    student_number: updateForm.value.student_number,
    organization_id: updateForm.value.organization_id,
    status: updateForm.value.status,
    profile_updated_at: new Date().toISOString(),
    last_profile_update_source: 'admin_widget',
    widget_version: '1.0.0'
  }

  const result = await updateUserMetadata(additionalData)

  if (result.error) {
    console.error('Failed to update profile:', result.error)
  } else {
    console.log('Profile updated successfully')
    showUpdateForm.value = false // Close form after successful update
    // Emit event to parent component
    emit('profile-updated', additionalData)
  }
}
</script>

<template>

    <v-card
    class="profiles-widget"
    elevation="2"
    rounded="lg"
  >
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-account-circle</v-icon>
        <span class="text-h6">Current Profile</span>
      </div>
      <v-btn
        icon
        size="small"
        variant="text"
        @click="refreshUserData"
        :loading="loading"
      >
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-card-title>

    <v-divider></v-divider>

    <v-card-text>
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-4">
        <v-progress-circular
          indeterminate
          color="primary"
          size="64"
        ></v-progress-circular>
        <p class="mt-3 text-body-2 text-medium-emphasis">Loading profile...</p>
      </div>

      <!-- Error State -->
      <v-alert
        v-else-if="error"
        type="error"
        variant="tonal"
        class="mb-0"
      >
        <template #title>Error Loading Profile</template>
        {{ error }}
        <template #append>
          <v-btn
            size="small"
            variant="text"
            @click="fetchCurrentUser"
          >
            Retry
          </v-btn>
        </template>
      </v-alert>

      <!-- Profile Content -->
      <div v-else-if="hasUserData" class="profile-content">
        <!-- User Avatar and Name -->
        <div class="d-flex flex-column align-center text-center mb-6">
          <v-avatar
            size="128"
            color="primary"
            class="mb-4 elevation-4"
          >
            <span class="text-h3 font-weight-bold text-white">{{ userInitials }}</span>
          </v-avatar>
          <div>
            <h2 class="text-h4 mb-2 font-weight-medium">{{ userDisplayName }}</h2>
            <p class="text-h6 text-medium-emphasis mb-0">{{ userEmail }}</p>
          </div>
        </div>

        <!-- Profile Details -->
        <v-list class="bg-transparent">
          <v-list-item
            v-if="roleDescription"
            prepend-icon="mdi-account-key"
            :title="`Role: ${roleDescription}`"
            subtitle="User Role"
          ></v-list-item>

          <v-list-item
            v-if="userCreatedAt"
            prepend-icon="mdi-calendar-plus"
            :title="`Joined: ${userCreatedAt}`"
            subtitle="Account Creation Date"
          ></v-list-item>

          <v-list-item
            v-if="currentUser?.user_metadata?.student_number"
            prepend-icon="mdi-school"
            :title="`Student Number: ${currentUser.user_metadata.student_number}`"
            subtitle="Student Identification Number"
          ></v-list-item>
        </v-list>




      </div>

      <!-- No User Data State -->
      <div v-else class="text-center py-4">
        <v-icon size="64" color="grey-lighten-1">mdi-account-off</v-icon>
        <h4 class="text-h6 mt-3 mb-2">No Profile Data</h4>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Unable to load profile information
        </p>
        <v-btn
          variant="outlined"
          @click="fetchCurrentUser"
        >
          Reload Profile
        </v-btn>
      </div>
    </v-card-text>
  </v-card>

</template>

<style scoped>
.profiles-widget {
  min-height: 400px;
}

.profile-content {
  min-height: 300px;
  padding: 8px 0;
}

.v-list-item {
  padding-left: 0;
  padding-right: 0;
  margin-bottom: 8px;
}

.v-avatar {
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.v-card-title {
  padding: 20px 24px 16px;
}

.v-card-text {
  padding: 24px;
}

/* Enhanced list styling */
.v-list {
  padding-top: 16px;
}

.v-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
  transition: background-color 0.2s ease;
}

.v-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* Form styling improvements */
.v-form {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
}

.v-text-field, .v-select {
  margin-bottom: 16px;
}
</style>
