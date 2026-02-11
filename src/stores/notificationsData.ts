// notificationsData.ts
import { computed, ref } from "vue";
import type { Ref } from "vue";
import { defineStore } from "pinia";
import { supabase, supabaseAdmin } from "@/lib/supabase";

type Notification = {
  id?: number;
  created_at?: string;
  title?: string;
  description?: string;
}

type NotificationInput = {
  title: string;
  description?: string;
}

export const useNotificationsStore = defineStore("notifications", () => {
  // States
  const notifications: Ref<Notification[]> = ref([]);
  const currentNotification: Ref<Notification | null> = ref(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const notificationsCount = computed(() => notifications.value.length);
  const hasNotifications = computed(() => notifications.value.length > 0);

  // Clear error helper
  const clearError = () => {
    error.value = null;
  };

  // Create notification
  async function createNotification(notificationData: NotificationInput) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('notifications')
        .insert([{
          title: notificationData.title,
          description: notificationData.description || null
        }])
        .select()
        .single();

      if (supabaseError) {
        error.value = `Failed to create notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Add to local state
      notifications.value.unshift(data);

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error creating notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get all notifications
  async function getAllNotifications() {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        error.value = `Failed to fetch notifications: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      notifications.value = data || [];
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error fetching notifications: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Get notification by ID
  async function getNotificationById(id: number) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();

      if (supabaseError) {
        error.value = `Failed to fetch notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      currentNotification.value = data;
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error fetching notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Update notification
  async function updateNotification(id: number, updateData: Partial<NotificationInput>) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (supabaseError) {
        error.value = `Failed to update notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Update local state
      const index = notifications.value.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications.value[index] = data;
      }

      if (currentNotification.value?.id === id) {
        currentNotification.value = data;
      }

      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error updating notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Delete notification
  async function deleteNotification(id: number) {
    loading.value = true;
    clearError();

    try {
      const { error: supabaseError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (supabaseError) {
        error.value = `Failed to delete notification: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      // Remove from local state
      notifications.value = notifications.value.filter(n => n.id !== id);

      if (currentNotification.value?.id === id) {
        currentNotification.value = null;
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error deleting notification: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Search notifications by title or description
  async function searchNotifications(searchTerm: string) {
    loading.value = true;
    clearError();

    try {
      const { data, error: supabaseError } = await supabase
        .from('notifications')
        .select('*')
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        error.value = `Failed to search notifications: ${supabaseError.message}`;
        return { error: supabaseError };
      }

      return { data: data || [] };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      error.value = `Error searching notifications: ${errorMessage}`;
      return { error: err };
    } finally {
      loading.value = false;
    }
  }

  // Clear current notification
  function clearCurrentNotification() {
    currentNotification.value = null;
  }

  // Clear all notifications from state
  function clearNotifications() {
    notifications.value = [];
  }

  return {
    // State
    notifications,
    currentNotification,
    loading,
    error,

    // Computed
    notificationsCount,
    hasNotifications,

    // Actions
    createNotification,
    getAllNotifications,
    getNotificationById,
    updateNotification,
    deleteNotification,
    searchNotifications,
    clearCurrentNotification,
    clearNotifications,
    clearError,
  };
});
