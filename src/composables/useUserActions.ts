import { ref } from 'vue'
import { useAuthUserStore } from '@/stores/authUser'
import { useToast } from 'vue-toastification'

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

interface ConfirmationDialogData {
  show: boolean
  title: string
  message: string
  action: (() => Promise<void>) | null
}

export function useUserActions() {
  const authStore = useAuthUserStore()
  const toast = useToast()

  // Loading states
  const editingUser = ref(false)
  const deletingUser = ref(false)

  // Dialog states
  const showEditDialog = ref(false)
  const showConfirmationDialog = ref<ConfirmationDialogData>({
    show: false,
    title: '',
    message: '',
    action: null
  })

  // Form data
  const selectedUser = ref<User | null>(null)
  const editForm = ref<EditUserData>({})

  /**
   * Open edit dialog for a user
   */
  const openEditDialog = (user: User) => {
    selectedUser.value = user
    editForm.value = {
      full_name: user.raw_user_meta_data?.full_name || '',
      role: user.raw_user_meta_data?.role || user.raw_app_meta_data?.role || 3, // Default to Student (role 3)
    }
    showEditDialog.value = true
  }

  /**
   * Close edit dialog
   */
  const closeEditDialog = () => {
    showEditDialog.value = false
    selectedUser.value = null
    editForm.value = {}
  }

  /**
   * Update user information
   */
  const updateUser = async (): Promise<{ success: boolean; error?: string }> => {
    if (!selectedUser.value) {
      return { success: false, error: 'No user selected' }
    }

    editingUser.value = true

    try {
      // Update user metadata (name AND role)
      const userMetadataResult = await authStore.updateUserMetadata(
        selectedUser.value.id,
        {
          full_name: editForm.value.full_name,
          role: editForm.value.role  // Add role to user_metadata too
        }
      )

      if (userMetadataResult.error) {
        const errorMsg = typeof userMetadataResult.error === 'string'
          ? userMetadataResult.error
          : (userMetadataResult.error as any)?.message || 'Failed to update user metadata'
        throw new Error(errorMsg)
      }

      // Update app metadata (role for admin-level access control)
      const appMetadataResult = await authStore.updateUserAppMetadata(
        selectedUser.value.id,
        {
          role: editForm.value.role
        }
      )

      if (appMetadataResult.error) {
        const errorMsg = typeof appMetadataResult.error === 'string'
          ? appMetadataResult.error
          : (appMetadataResult.error as any)?.message || 'Failed to update user role'
        throw new Error(errorMsg)
      }

      toast.success(`Successfully updated ${selectedUser.value.email}`)
      closeEditDialog()
      return { success: true }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      editingUser.value = false
    }
  }

  /**
   * Show delete confirmation dialog
   */
  const confirmDeleteUser = (user: User) => {
    showConfirmationDialog.value = {
      show: true,
      title: 'Delete User',
      message: `Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`,
      action: () => executeDeleteUser(user)
    }
  }

  /**
   * Execute user deletion
   */
  const executeDeleteUser = async (user: User): Promise<void> => {
    deletingUser.value = true

    try {
      const result = await authStore.deleteUser(user.id)

      if (result.error) {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : (result.error as any)?.message || 'Failed to delete user'
        throw new Error(errorMsg)
      }

      toast.success(`Successfully deleted ${user.email}`)
      closeConfirmationDialog()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user'
      toast.error(errorMessage)
    } finally {
      deletingUser.value = false
    }
  }

  /**
   * Close confirmation dialog
   */
  const closeConfirmationDialog = () => {
    showConfirmationDialog.value = {
      show: false,
      title: '',
      message: '',
      action: null
    }
  }

  /**
   * Execute confirmed action
   */
  const executeConfirmedAction = async () => {
    if (showConfirmationDialog.value.action) {
      await showConfirmationDialog.value.action()
    }
  }

  /**
   * Ban user with confirmation
   */
  const confirmBanUser = (user: User, duration: string = '24h', reason?: string) => {
    showConfirmationDialog.value = {
      show: true,
      title: 'Ban User',
      message: `Are you sure you want to ban ${user.email} for ${duration}?${reason ? ` Reason: ${reason}` : ''}`,
      action: () => executeBanUser(user, duration, reason)
    }
  }

  /**
   * Execute user ban
   */
  const executeBanUser = async (user: User, duration: string = '24h', reason?: string): Promise<void> => {
    try {
      const result = await authStore.banUser(user.id, duration, reason)

      if (result.error) {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : (result.error as any)?.message || 'Failed to ban user'
        throw new Error(errorMsg)
      }

      toast.success(`Successfully banned ${user.email}`)
      closeConfirmationDialog()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to ban user'
      toast.error(errorMessage)
    }
  }

  /**
   * Unban user with confirmation
   */
  const confirmUnbanUser = (user: User) => {
    showConfirmationDialog.value = {
      show: true,
      title: 'Unban User',
      message: `Are you sure you want to unban ${user.email}?`,
      action: () => executeUnbanUser(user)
    }
  }

  /**
   * Execute user unban
   */
  const executeUnbanUser = async (user: User): Promise<void> => {
    try {
      const result = await authStore.unbanUser(user.id)

      if (result.error) {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : (result.error as any)?.message || 'Failed to unban user'
        throw new Error(errorMsg)
      }

      toast.success(`Successfully unbanned ${user.email}`)
      closeConfirmationDialog()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unban user'
      toast.error(errorMessage)
    }
  }

  return {
    // Loading states
    editingUser,
    deletingUser,

    // Dialog states
    showEditDialog,
    showConfirmationDialog,

    // Form data
    selectedUser,
    editForm,

    // Actions
    openEditDialog,
    closeEditDialog,
    updateUser,
    confirmDeleteUser,
    confirmBanUser,
    confirmUnbanUser,
    closeConfirmationDialog,
    executeConfirmedAction,
  }
}
