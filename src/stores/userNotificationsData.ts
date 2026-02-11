// userNotificationsData.ts
import { computed, ref } from "vue";
import type { Ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";

type UserNotification = {
  id?: number;
  created_at?: string;
  user_id?: string;
  notification_id?: number;
  is_read?: boolean;
  // Joined notification data
  notification?: {
    id: number;
    title?: string;
    description?: string;
    created_at?: string;
  };
}

type UserNotificationInput = {
  user_id: string;
  notification_id: number;
  is_read?: boolean;
}

export const useUserNotificationsStore = defineStore("userNotifications", () => {
  // States
  const userNotifications: Ref<UserNotification[]> = ref([]);
  const currentUserNotification: Ref<UserNotification | null> = ref(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const totalNotifications = computed(() => userNotifications.value.length);
  const unreadNotifications = computed(() =>
    userNotifications.value.filter(n => !n.is_read)
  );
  const readNotifications = computed(() =>
    userNotifications.value.filter(n => n.is_read)
  );
  const unreadCount = computed(() => unreadNotifications.value.length);
  const hasUnreadNotifications = computed(() => unreadCount.value > 0);

  // Clear error helper
  const clearError = () => {
    error.value = null;
  };

  // Create user notification (assign notification to user)
  async function createUserNotification(notificationData: UserNotificationInput) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .insert([{
          user_id: notificationData.user_id,
          notification_id: notificationData.notification_id,
          is_read: notificationData.is_read || false
        }])
        .select(`
          *,
          notification:notifications(*)
        `)
        .single();

      if (supabaseError) {
        error.value = `Failed to create user notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Add to local state
      userNotifications.value.unshift(data);

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error creating user notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get all user notifications for a specific user
  async function getUserNotifications(userId: string) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        error.value = `Failed to fetch user notifications: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      userNotifications.value = data || [];
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error fetching user notifications: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get unread notifications for a user
  async function getUnreadNotifications(userId: string) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        error.value = `Failed to fetch unread notifications: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      return { data: data || [] };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error fetching unread notifications: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get user notification by ID
  async function getUserNotificationById(id: number) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('id', id)
        .single();

      if (supabaseError) {
        error.value = `Failed to fetch user notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      currentUserNotification.value = data;
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error fetching user notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Mark notification as read
  async function markAsRead(id: number) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select(`
          *,
          notification:notifications(*)
        `)
        .single();

      if (supabaseError) {
        error.value = `Failed to mark notification as read: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Update local state
      const index = userNotifications.value.findIndex(n => n.id === id);
      if (index !== -1) {
        userNotifications.value[index] = data;
      }

      if (currentUserNotification.value?.id === id) {
        currentUserNotification.value = data;
      }

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error marking notification as read: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Mark notification as unread
  async function markAsUnread(id: number) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .update({ is_read: false })
        .eq('id', id)
        .select(`
          *,
          notification:notifications(*)
        `)
        .single();

      if (supabaseError) {
        error.value = `Failed to mark notification as unread: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Update local state
      const index = userNotifications.value.findIndex(n => n.id === id);
      if (index !== -1) {
        userNotifications.value[index] = data;
      }

      if (currentUserNotification.value?.id === id) {
        currentUserNotification.value = data;
      }

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error marking notification as unread: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Mark all notifications as read for a user
  async function markAllAsRead(userId: string) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select(`
          *,
          notification:notifications(*)
        `);

      if (supabaseError) {
        error.value = `Failed to mark all notifications as read: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Update local state for all updated notifications
      if (data) {
        data.forEach(updatedNotification => {
          const index = userNotifications.value.findIndex(n => n.id === updatedNotification.id);
          if (index !== -1) {
            userNotifications.value[index] = updatedNotification;
          }
        });
      }

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error marking all notifications as read: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Delete user notification
  async function deleteUserNotification(id: number) {
    loading.value = true;
    clearError();

    try {
      const { error: supabaseError } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', id);

      if (supabaseError) {
        error.value = `Failed to delete user notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Remove from local state
      userNotifications.value = userNotifications.value.filter(n => n.id !== id);

      if (currentUserNotification.value?.id === id) {
        currentUserNotification.value = null;
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error deleting user notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Delete all notifications for a user
  async function deleteAllUserNotifications(userId: string) {
    loading.value = true;
    clearError();

    try {
      const { error: supabaseError } = await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', userId);

      if (supabaseError) {
        error.value = `Failed to delete all user notifications: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Clear local state for this user
      userNotifications.value = userNotifications.value.filter(n => n.user_id !== userId);

      if (currentUserNotification.value?.user_id === userId) {
        currentUserNotification.value = null;
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error deleting all user notifications: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Send notification to multiple users
  async function sendNotificationToUsers(notificationId: number, userIds: string[]) {
    loading.value = true;
    clearError();

    try {
      const userNotificationData = userIds.map(userId => ({
        user_id: userId,
        notification_id: notificationId,
        is_read: false
      }));

      const { data, error: supabaseError } = await supabase
        .from('user_notifications')
        .insert(userNotificationData)
        .select(`
          *,
          notification:notifications(*)
        `);

      if (supabaseError) {
        error.value = `Failed to send notification to users: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Add to local state if any of these belong to current user
      if (data) {
        data.forEach(notification => {
          userNotifications.value.unshift(notification);
        });
      }

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error sending notification to users: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get notification count for user
  async function getNotificationCount(userId: string) {
    clearError();

    try {
      const { count, error: supabaseError } = await supabase
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (supabaseError) {
        error.value = `Failed to get notification count: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      return { count: count || 0 };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error getting notification count: ${errorMessage}`;
      return { error: err };
    }
  }

  // Get unread notification count for user
  async function getUnreadCount(userId: string) {
    clearError();

    try {
      const { count, error: supabaseError } = await supabase
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (supabaseError) {
        error.value = `Failed to get unread count: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      return { count: count || 0 };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error getting unread count: ${errorMessage}`;
      return { error: err };
    }
  }

  // Clear current user notification
  function clearCurrentUserNotification() {
    currentUserNotification.value = null;
  }

  // Clear all user notifications from state
  function clearUserNotifications() {
    userNotifications.value = [];
  }

  return {
    // State
    userNotifications,
    currentUserNotification,
    loading,
    error,

    // Computed
    totalNotifications,
    unreadNotifications,
    readNotifications,
    unreadCount,
    hasUnreadNotifications,

    // Actions
    createUserNotification,
    getUserNotifications,
    getUnreadNotifications,
    getUserNotificationById,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteUserNotification,
    deleteAllUserNotifications,
    sendNotificationToUsers,
    getNotificationCount,
    getUnreadCount,
    clearCurrentUserNotification,
    clearUserNotifications,
    clearError,
  };
});
