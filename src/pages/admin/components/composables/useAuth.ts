import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthUserStore } from '@/stores/authUser'

export function useAuth() {
  const currentUser = ref<any>(null)
  const isCurrentUserAdmin = ref(false)

  /**
   * Check if current user is admin
   */
  const checkIfUserIsAdmin = async (user: any): Promise<boolean> => {
    if (!user) return false

    try {
      const authStore = useAuthUserStore()
      const { users, error } = await authStore.getAllUsers()

      if (error) return false

      const currentUserData = users?.find(u => u.id === user.id)
      const roleId = currentUserData?.raw_user_meta_data?.role ||
                     currentUserData?.raw_app_meta_data?.role

      return roleId === 1
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  /**
   * Get current user and check admin status
   */
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser.value = user

    if (user) {
      isCurrentUserAdmin.value = await checkIfUserIsAdmin(user)
    }

    return { user, isAdmin: isCurrentUserAdmin.value }
  }

  return {
    currentUser,
    isCurrentUserAdmin,
    getCurrentUser,
    checkIfUserIsAdmin,
  }
}
