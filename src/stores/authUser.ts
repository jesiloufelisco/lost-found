//authUser.ts
import { computed, ref } from "vue";
import type { Ref } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "vue-router";
import { supabase, supabaseAdmin } from "@/lib/supabase";
interface UserData {
  id?: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

interface SessionUser {
  id: string;
  email?: string;
  user_metadata: Record<string, any>;
}

export const useAuthUserStore = defineStore("authUser", () => {
  // States
  const userData: Ref<UserData | null> = ref(null);
  const authPages: Ref<string[]> = ref([]);
  const authBranchIds: Ref<number[]> = ref([]);
  const loading = ref(false);
  const router = useRouter();

  // Computed properties
  const isAuthenticated = computed(() => userData.value !== null);
  const userEmail = computed(() => userData.value?.email || null);
  const userName = computed(() => userData.value?.user_metadata?.full_name || userData.value?.email || null);
  const userRoleId = computed(() =>
    userData.value?.user_metadata?.role ||
    userData.value?.app_metadata?.role ||
    null
  );


  async function registerUser(
    email: string,
    password: string,
    username: string,
    roleId: number
  ) {
    loading.value = true;
    try {
      // Create the user with profile data and role in user_metadata
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: username,
            role: roleId,
          }
        }
      });

      if (signUpError) {
        return { error: signUpError };
      }

      if (!signUpData.user) {
        return { error: new Error("Signup failed") };
      }

      // Optionally, also set app_metadata for admin-level role management
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        signUpData.user.id,
        {
          app_metadata: {
            role: roleId,
            permissions: [],
            status: 'active',
            created_by: 'system',
            created_at: new Date().toISOString()
          }
        }
      );

      if (updateError) {
        console.warn('Failed to set app_metadata:', updateError);
        // Continue with registration even if app_metadata update fails
      }

      return { data: { id: signUpData.user.id, email } };
    } finally {
      loading.value = false;
    }
  }

  async function signIn(email: string, password: string, rememberMe = false) {
    loading.value = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (!data.session) {
        return { error: new Error("No session") };
      }

      const user = data.user;
      localStorage.setItem("access_token", data.session.access_token);
      localStorage.setItem("refresh_token", data.session.refresh_token);
      localStorage.setItem("auth_id", user.id);

      // Update the store's userData with Supabase user data only
      userData.value = {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      };

      return { user };
    } finally {
      loading.value = false;
    }
  }

  async function signOut() {
    loading.value = true;
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error };
      }

      // Clear local storage
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("auth_id");

      // Clear user data
      userData.value = null;

      // Redirect to home or login page
      router.push("/");

      return { success: true };
    } finally {
      loading.value = false;
    }
  }

  // Initialize auth state on store creation
  async function initializeAuth() {
    loading.value = true;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        userData.value = null;
        return;
      }

      // Set user data from Supabase auth user only
      userData.value = {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      };
    } catch (error) {
      console.error("Error initializing auth:", error);
      userData.value = null;
    } finally {
      loading.value = false;
    }
  }


  // Get current authenticated user
  async function getCurrentUser() {
    loading.value = true;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        return { error };
      }

      if (!user) {
        return { error: new Error("No authenticated user") };
      }

      const userData = {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      };

      // Log user role ID from both locations for debugging
      const roleIdFromUserMeta = user.user_metadata?.role;
      const roleIdFromAppMeta = user.app_metadata?.role;
      console.log('getCurrentUser - User Role ID from user_metadata:', roleIdFromUserMeta);
      console.log('getCurrentUser - User Role ID from app_metadata:', roleIdFromAppMeta);
      console.log('getCurrentUser - Full user_metadata:', user.user_metadata);
      console.log('getCurrentUser - Full app_metadata:', user.app_metadata);

      return { user: userData };
    } catch (error) {
      console.error("Error fetching current user:", error);
      return { error };
    } finally {
      loading.value = false;
    }
  }

  // Get all users (admin function)
  async function getAllUsers() {
    loading.value = true;
    try {
      // First, get all users from Supabase Auth using service role
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

      if (authError) {
        return { error: authError };
      }

      // Map auth users to consistent format
      const allUsers = authData.users.map(user => {
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          raw_user_meta_data: user.user_metadata,
          raw_app_meta_data: user.app_metadata,
        };
      });

      return { users: allUsers };
    } catch (error) {
      console.error("Error fetching all users:", error);
      return { error };
    } finally {
      loading.value = false;
    }
  }

  // Update user metadata (admin function)
  async function updateUserMetadata(userId: string, additionalData: Record<string, any>) {
    loading.value = true;
    try {
      // First, get the current user to preserve existing metadata
      const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (getUserError) {
        return { error: getUserError };
      }

      // Merge with existing user_metadata (not app_metadata)
      const existingUserMetadata = currentUser.user?.user_metadata || {};

      // Update user metadata using admin client
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingUserMetadata,
          ...additionalData,
          last_updated: new Date().toISOString()
        }
      });

      if (error) {
        return { error };
      }      // If updating current user, refresh local userData
      if (userData.value?.id === userId) {
        await initializeAuth();
      }

      return { data };
    } catch (error) {
      console.error("Error updating user metadata:", error);
      return { error };
    } finally {
      loading.value = false;
    }
  }

  // Update app metadata (admin only - for roles, permissions, access control)
  async function updateUserAppMetadata(userId: string, appData: Record<string, any>) {
    loading.value = true;
    try {
      // First, get the current user to preserve existing app_metadata
      const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (getUserError) {
        return { error: getUserError };
      }

      // Merge with existing app_metadata
      const existingAppMetadata = currentUser.user?.app_metadata || {};

      // Update app metadata using admin client (service role required)
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...existingAppMetadata,
          ...appData,
          last_updated: new Date().toISOString(),
          updated_by: userData.value?.id || 'system'
        }
      });

      if (error) {
        return { error };
      }

      // If updating current user, refresh local userData
      if (userData.value?.id === userId) {
        await initializeAuth();
      }

      return { data };
    } catch (error) {
      console.error("Error updating user app metadata:", error);
      return { error };
    } finally {
      loading.value = false;
    }
  }

  // Ban user function (uses app_metadata)
  async function banUser(userId: string, banDuration: string = '24h', reason?: string) {
    const banData = {
      banned: true,
      ban_duration: banDuration,
      ban_reason: reason || 'Violation of terms',
      banned_at: new Date().toISOString(),
      banned_until: banDuration === 'none' ? null : new Date(Date.now() + parseDuration(banDuration)).toISOString()
    };

    return await updateUserAppMetadata(userId, banData);
  }

  // Unban user function
  async function unbanUser(userId: string) {
    const unbanData = {
      banned: false,
      ban_duration: 'none',
      ban_reason: null,
      banned_at: null,
      banned_until: null,
      unbanned_at: new Date().toISOString()
    };

    return await updateUserAppMetadata(userId, unbanData);
  }

  // Delete user function (admin only)
  async function deleteUser(userId: string) {
    loading.value = true;
    try {
      // Delete the user using admin client
      const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        return { error };
      }

      return { data };
    } catch (error) {
      console.error("Error deleting user:", error);
      return { error };
    } finally {
      loading.value = false;
    }
  }

  // Helper function to parse duration strings
  function parseDuration(duration: string): number {
    const units: { [key: string]: number } = {
      'ns': 1e-6,
      'us': 1e-3, 'µs': 1e-3,
      'ms': 1,
      's': 1000,
      'm': 60000,
      'h': 3600000
    };

    const match = duration.match(/^(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)$/);
    if (!match) return 0;

    const [, value, unit] = match;
    return parseFloat(value) * units[unit];
  }

  // Get role title by role ID (for any user)
  async function getRoleTitleById(roleId: number) {
    try {
      console.log('getRoleTitleById - Getting role title for ID:', roleId);

      if (!roleId) {
        console.log('getRoleTitleById - No role ID provided, returning null');
        return { title: null, error: null };
      }

      // Use hardcoded role mappings instead of database query
      const roleMapping: { [key: number]: string } = {
        1: 'Admin',
        2: 'User',
        3: 'Student',
        4: 'Faculty'
      };

      const title = roleMapping[roleId] || 'Unknown Role';
      console.log('getRoleTitleById - Role title:', title);
      return { title, error: null };
    } catch (error) {
      console.error('getRoleTitleById - Unexpected error:', error);
      return { title: null, error };
    }
  }

  // Get current user's role title
  async function getCurrentUserRoleTitle() {
    try {
      const roleId = userData.value?.user_metadata?.role;
      console.log('getCurrentUserRoleTitle - Role ID:', roleId);

      if (!roleId) {
        console.log('getCurrentUserRoleTitle - No role ID found, returning null');
        return { title: null, error: null };
      }

      // Use hardcoded role mappings instead of database query
      const roleMapping: { [key: number]: string } = {
        1: 'Admin',
        2: 'User',
        3: 'Student',
        4: 'Faculty'
      };

      const title = roleMapping[roleId] || 'Unknown Role';
      console.log('getCurrentUserRoleTitle - Role title:', title);
      return { title, error: null };
    } catch (error) {
      console.error('getCurrentUserRoleTitle - Unexpected error:', error);
      return { title: null, error };
    }
  }

  // Call initialize on store creation
  initializeAuth();

  return {
    // State
    userData,
    authPages,
    authBranchIds,
    loading,

    // Computed
    isAuthenticated,
    userEmail,
    userName,
    userRoleId,

    // Actions
    registerUser,
    signIn,
    signOut,
    initializeAuth,
    getCurrentUser,
    getAllUsers,
    updateUserMetadata,
    updateUserAppMetadata,
    deleteUser,
    banUser,
    unbanUser,
    getRoleTitleById,
    getCurrentUserRoleTitle,
  };
});

// Utility function for logout (can be used independently)
export async function doLogout() {
  const authStore = useAuthUserStore();
  return await authStore.signOut();
}
