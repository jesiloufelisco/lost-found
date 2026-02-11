<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthUserStore } from '@/stores/authUser'
import { useUserRolesStore } from '@/stores/roles'

const authStore = useAuthUserStore()
const rolesStore = useUserRolesStore()

// Form data
const profileForm = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  address: '',
  bio: '',
  organization: '',
  studentNumber: ''
})

// Get current user role
const currentUserRole = computed(() => {
  const roleId = authStore.userData?.user_metadata?.role ||
                 authStore.userData?.app_metadata?.role;

  if (roleId) {
    return rolesStore.roles.find(role => role.id === roleId);
  }
  return null;
})

// Check if current user is a student (should show student number field)
const isStudent = computed(() => {
  if (!currentUserRole.value) return false;

  // Check if the role title contains "student" (case insensitive)
  return currentUserRole.value.title.toLowerCase().includes('student');
})

// Check if current user is admin (for backward compatibility)
const isAdmin = computed(() => {
  if (!currentUserRole.value) return false;

  // Check if the role title contains "admin" (case insensitive)
  return currentUserRole.value.title.toLowerCase().includes('admin');
})

// Form state
const isUpdating = ref(false)
const formErrors = ref<Record<string, string>>({})
const successMessage = ref('')

// Load current user data into form
onMounted(async () => {
  // Load roles if not already loaded
  if (rolesStore.roles.length === 0) {
    await rolesStore.fetchRoles()
  }

  await loadCurrentUserData()
})

// Handle profile update
const updateProfile = async () => {
  isUpdating.value = true
  formErrors.value = {}
  successMessage.value = ''

  try {
    // Basic validation
    if (!profileForm.value.fullName.trim()) {
      formErrors.value = { general: 'Full name is required.' }
      return
    }

    // Get current user to get the user ID
    const currentUserResult = await authStore.getCurrentUser()
    if (currentUserResult.error || !currentUserResult.user) {
      formErrors.value = { general: 'Unable to get current user information.' }
      return
    }

    const userId = currentUserResult.user.id

    // Prepare the metadata update object with trimmed values
    const metadataUpdate: Record<string, string> = {
      full_name: profileForm.value.fullName.trim(),
      phone_number: profileForm.value.phoneNumber.trim(),
      address: profileForm.value.address.trim(),
      bio: profileForm.value.bio.trim(),
      organization: profileForm.value.organization.trim()
    }

    // Only include student number if the user is a student
    if (isStudent.value) {
      metadataUpdate.student_number = profileForm.value.studentNumber.trim()
    }

    // Call the updateUserMetadata function from authUser store
    const result = await authStore.updateUserMetadata(userId, metadataUpdate)

    if (result.error) {
      const errorMessage = (result.error as any)?.message || 'Failed to update profile. Please try again.'
      formErrors.value = { general: errorMessage }
      return
    }

    // Success - show success message and refresh user data
    successMessage.value = 'Profile updated successfully!'

    // Refresh the form with updated data after a short delay
    setTimeout(async () => {
      await loadCurrentUserData()
    }, 500)

  } catch (error) {
    console.error('Error updating profile:', error)
    formErrors.value = { general: 'An unexpected error occurred. Please try again.' }
  } finally {
    isUpdating.value = false
  }
}

// Extract user data loading into separate function for reuse
const loadCurrentUserData = async () => {
  const result = await authStore.getCurrentUser()
  if (result.user) {
    profileForm.value = {
      fullName: result.user.user_metadata?.full_name || '',
      email: result.user.email || '',
      phoneNumber: result.user.user_metadata?.phone_number || '',
      address: result.user.user_metadata?.address || '',
      bio: result.user.user_metadata?.bio || '',
      organization: result.user.user_metadata?.organization || '',
      // Only load student number if the user is a student
      studentNumber: isStudent.value ? (result.user.user_metadata?.student_number || '') : ''
    }
  }
}
</script>

<template>
  <v-card elevation="2" rounded="lg" id="profile-form">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2" color="primary">mdi-account-edit</v-icon>
      <span class="text-h6">Edit Profile Information</span>
    </v-card-title>

    <v-divider></v-divider>

    <v-card-text class="pa-6">
      <!-- Success Message -->
      <v-alert
        v-if="successMessage"
        type="success"
        variant="tonal"
        class="mb-4"
        closable
        @click:close="successMessage = ''"
      >
        {{ successMessage }}
      </v-alert>

      <!-- Error Message -->
      <v-alert
        v-if="formErrors.general"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        @click:close="formErrors.general = ''"
      >
        {{ formErrors.general }}
      </v-alert>

      <!-- Profile Form -->
      <v-form @submit.prevent="updateProfile">
        <v-row>
          <!-- Full Name -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="profileForm.fullName"
              label="Full Name"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              :disabled="isUpdating"
            ></v-text-field>
          </v-col>

          <!-- Email -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="profileForm.email"
              label="Email Address"
              prepend-inner-icon="mdi-email"
              variant="outlined"
              type="email"
              :disabled="isUpdating"
              readonly
              hint="Email cannot be changed here"
              persistent-hint
            ></v-text-field>
          </v-col>

          <!-- Phone Number -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="profileForm.phoneNumber"
              label="Phone Number"
              prepend-inner-icon="mdi-phone"
              variant="outlined"
              :disabled="isUpdating"
            ></v-text-field>
          </v-col>

          <!-- Student Number (only show for student roles) -->
          <v-col v-if="isStudent" cols="12" md="6">
            <v-text-field
              v-model="profileForm.studentNumber"
              label="Student Number"
              prepend-inner-icon="mdi-school"
              variant="outlined"
              :disabled="isUpdating"
              hint="Only visible to users with Student role"
              persistent-hint
            ></v-text-field>
          </v-col>

          <!-- Organization -->
          <v-col cols="12">
            <v-text-field
              v-model="profileForm.organization"
              label="Organization/Department"
              prepend-inner-icon="mdi-domain"
              variant="outlined"
              :disabled="isUpdating"
            ></v-text-field>
          </v-col>

          <!-- Address -->
          <v-col cols="12">
            <v-textarea
              v-model="profileForm.address"
              label="Address"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
              rows="2"
              :disabled="isUpdating"
            ></v-textarea>
          </v-col>

          <!-- Bio -->
          <v-col cols="12">
            <v-textarea
              v-model="profileForm.bio"
              label="Bio/About"
              prepend-inner-icon="mdi-information"
              variant="outlined"
              rows="3"
              :disabled="isUpdating"
              counter="500"
              hint="Tell us about yourself"
              persistent-hint
            ></v-textarea>
          </v-col>
        </v-row>

        <!-- Update Button -->
        <div class="d-flex justify-end mt-4">
          <v-btn
            type="submit"
            color="primary"
            size="large"
            :loading="isUpdating"
            :disabled="isUpdating"
            prepend-icon="mdi-content-save"
          >
            {{ isUpdating ? 'Updating...' : 'Update Profile' }}
          </v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>
