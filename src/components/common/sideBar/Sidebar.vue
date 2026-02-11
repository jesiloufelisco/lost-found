<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useDisplay } from "vuetify";
import { useRouter, useRoute } from "vue-router";
import { useAuthUserStore } from "@/stores/authUser";
import { useUserRolesStore } from "@/stores/roles";
import { useUserPagesStore } from "@/stores/pages";
import { useSidebarStore } from "@/stores/sidebar";
import { navigationConfig, individualNavItems } from "@/utils/navigation";
import { supabase } from "@/lib/supabase";

// Vuetify display composable for responsive design
const { smAndDown } = useDisplay();

// Vue Router
const router = useRouter();
const route = useRoute();

// Stores
const authStore = useAuthUserStore();
const rolesStore = useUserRolesStore();
const pagesStore = useUserPagesStore();
const sidebarStore = useSidebarStore();

// Reactive state for sidebar
const isExpanded = ref(true);

// Control admin group expansion - make it persistent
const adminGroupExpanded = ref(true);

// Control organization group expansion - make it persistent
const organizationGroupExpanded = ref(true);

// Control my account group expansion - make it persistent
const myAccountGroupExpanded = ref(true);

// User role and pages data
const userRolePages = ref<string[]>([]);
const currentUserRole = ref<any>(null);

// Real-time subscription for messages
let messagesSubscription: any = null;

// Load user role and pages on mount
onMounted(async () => {
  // Load roles if not already loaded
  if (rolesStore.roles.length === 0) {
    await rolesStore.fetchRoles();
  }

  // Get user role and allowed pages
  await loadUserRoleAndPages();

  // Initialize unread message count for sidebar
  if (authStore.userData?.id) {
    await sidebarStore.updateUnreadMessageCount(authStore.userData.id);
    setupMessagesRealtimeSubscription();
  }
});

// Function to load user role and pages
const loadUserRoleAndPages = async () => {
  try {
    const roleId = authStore.userData?.user_metadata?.role ||
                   authStore.userData?.app_metadata?.role;

    console.log('Loading sidebar - User Role ID:', roleId);

    if (roleId) {
      // Find the role details from the store
      currentUserRole.value = rolesStore.roles.find(role => role.id === roleId);
      console.log('Found user role:', currentUserRole.value);

      // Get pages accessible by this role
      const rolePages = await pagesStore.fetchRolePagesByRoleId(roleId);
      console.log('Role pages from DB:', rolePages);

      if (rolePages && rolePages.length > 0) {
        userRolePages.value = rolePages
          .map(rolePage => rolePage.pages)
          .filter(Boolean);
        console.log('User accessible pages:', userRolePages.value);
      }
    }
  } catch (error) {
    console.error('Error loading user role and pages:', error);
  }
};

// Setup real-time subscription for messages to update sidebar badge
const setupMessagesRealtimeSubscription = () => {
  if (!authStore.userData?.id) return;

  console.log('Setting up sidebar real-time subscription for messages');

  messagesSubscription = supabase
    .channel('sidebar-messages-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        console.log('New message inserted - updating sidebar badge:', payload.new);
        const message = payload.new as any;

        // Only count messages not sent by current user
        if (message.user_id !== authStore.userData?.id) {
          sidebarStore.incrementUnreadCount();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        console.log('Message updated - checking sidebar badge:', payload.new);
        // If a message was marked as read, update the count
        if (authStore.userData?.id) {
          await sidebarStore.updateUnreadMessageCount(authStore.userData.id);
        }
      }
    )
    .subscribe((status) => {
      console.log('Sidebar messages real-time subscription status:', status);
    });
};

// Cleanup real-time subscription
const cleanupMessagesSubscription = () => {
  if (messagesSubscription) {
    supabase.removeChannel(messagesSubscription);
    messagesSubscription = null;
    console.log('Sidebar messages real-time subscription cleaned up');
  }
};

// Add onBeforeUnmount to cleanup subscription
onBeforeUnmount(() => {
  cleanupMessagesSubscription();
});

// Computed property to check if user has access to admin features
const hasAdminAccess = computed(() => {
  // Check if user has access to any admin routes
  return userRolePages.value.some(page =>
    page.startsWith('/admin/')
  );
});

// Computed property to check if user is admin (for backward compatibility)
const isAdmin = computed(() => {
  // Check if the user's role title contains "admin" (case insensitive)
  if (currentUserRole.value) {
    return currentUserRole.value.title.toLowerCase().includes('admin');
  }

  // Fallback to checking if they have admin access
  return hasAdminAccess.value;
});

// Computed property for panel title
const panelTitle = computed(() => {
  if (currentUserRole.value) {
    return `${currentUserRole.value.title} Panel`;
  }
  return isAdmin.value ? 'Admin Panel' : 'User Panel';
});

// Watch for route changes and keep admin group expanded if we're on an admin route
watch(
  () => route.path,
  (newPath) => {
    if (
      newPath === "/admin/dashboard" ||
      newPath === "/admin/users" ||
      newPath === "/admin/roles" ||
      newPath === "/admin/support-inbox"
    ) {
      adminGroupExpanded.value = true;
    }
    if (newPath.startsWith("/organization")) {
      organizationGroupExpanded.value = true;
    }
    if (newPath.startsWith("/account")) {
      myAccountGroupExpanded.value = true;
    }
  },
  { immediate: true }
);

// Watch for user data changes and reload role/pages
watch(
  () => authStore.userData,
  async (newUserData, oldUserData) => {
    if (newUserData) {
      await loadUserRoleAndPages();

      // Update sidebar unread count when user changes
      if (newUserData.id && newUserData.id !== oldUserData?.id) {
        await sidebarStore.updateUnreadMessageCount(newUserData.id);
        // Setup real-time subscription for new user
        cleanupMessagesSubscription();
        setupMessagesRealtimeSubscription();
      }
    } else {
      // User logged out, reset unread count
      sidebarStore.resetUnreadCount();
      cleanupMessagesSubscription();
    }
  },
  { immediate: false }
);

// Watch for roles changes and reload user role info
watch(
  () => rolesStore.roles,
  async (newRoles) => {
    if (newRoles.length > 0 && authStore.userData) {
      await loadUserRoleAndPages();
    }
  },
  { immediate: false }
);

// Hide sidebar on small screens
const showSidebar = computed(() => !smAndDown.value);

// Helper function to check if user has access to a specific page/route
const hasPageAccess = (route: string) => {
  const hasAccess = userRolePages.value.includes(route);
  console.log(`Checking access for route "${route}":`, hasAccess);
  return hasAccess;
};

// Filter individual navigation items based on user access
const filteredIndividualNavItems = computed(() => {
  const filtered = individualNavItems.filter(item => {
    // If no permission specified, allow access
    if (!item.permission) return true;

    // Check if user has access to this specific route
    return hasPageAccess(item.route);
  });

  console.log('Filtered individual nav items:', filtered);
  return filtered;
});

// Filter navigation groups based on user access
const filteredNavigationGroups = computed(() => {
  const filtered = navigationConfig
    .map(group => {
      // Filter children based on user access
      const filteredChildren = group.children.filter(child => {
        // If no permission specified, allow access
        if (!child.permission) return true;

        // Check if user has access to this specific route
        return hasPageAccess(child.route);
      });

      // Only include the group if it has accessible children
      if (filteredChildren.length > 0) {
        return {
          ...group,
          children: filteredChildren
        };
      }

      return null;
    })
    .filter((group): group is NonNullable<typeof group> => group !== null); // Remove null groups with type guard

  console.log('Filtered navigation groups:', filtered);
  return filtered;
});

// Get navigation groups from shared config, filtered by user role and access
const navigationGroups = computed(() => {
  return filteredNavigationGroups.value;
});

// Helper function to get group expansion state
const getGroupExpansion = (groupTitle: string) => {
  if (groupTitle === "Admin") return adminGroupExpanded;
  /*  if (groupTitle === 'My Organization') return organizationGroupExpanded
  if (groupTitle === 'My Account') return myAccountGroupExpanded */
  return ref(true);
};

// Methods
const navigateTo = (route: string) => {
  router.push(route);
};

// Check if route is active
const isRouteActive = (routePath: string) => {
  return route.path === routePath;
};

// Logout function
const handleLogout = async () => {
  await authStore.signOut();
};
</script>

<template>
  <v-navigation-drawer
    v-if="showSidebar"
    v-model="isExpanded"
    :permanent="!smAndDown"
    :temporary="smAndDown"
    app
    fixed
    class="elevation-2 sidebar-full-height"
    width="280"
    color="background"
  >
    <!-- Sidebar Header -->
    <v-list-item class="pa-4">
      <v-list-item-content>
        <v-list-item-title class="text-h6 font-weight-bold primary--text">
          {{ panelTitle }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption grey--text">
          Management System
        </v-list-item-subtitle>
        <!-- Debug Info (remove this in production) -->
        <v-list-item-subtitle class="text-caption grey--text mt-1" v-if="currentUserRole">
          Role: {{ currentUserRole.title }} (ID: {{ currentUserRole.id }})
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-divider class="mx-4"></v-divider>

    <!-- Navigation Menu -->
    <v-list nav class="pa-2">
      <!-- Individual Navigation Items (non-grouped) -->
      <div
        v-if="filteredIndividualNavItems.length > 0"
        class="individual-nav-section mb-3"
      >
        <v-list-item
          v-for="item in filteredIndividualNavItems"
          :key="item.title"
          @click="navigateTo(item.route)"
          class="mb-1 rounded-lg"
          :class="{ 'v-list-item--active': isRouteActive(item.route) }"
          :prepend-icon="item.icon"
        >
          <v-list-item-title class="font-weight-medium d-flex align-center justify-space-between">
            <span>{{ item.title }}</span>
            <!-- Badge for Support Inbox when there are unread messages -->
            <v-badge
              v-if="item.route === '/admin/support-inbox' && sidebarStore.hasUnreadMessages"
              :content="sidebarStore.totalUnreadMessages"
              color="error"
              inline
            >
              <v-icon size="0" />
            </v-badge>
          </v-list-item-title>
        </v-list-item>

        <!-- Divider after individual items -->
        <v-divider
          v-if="navigationGroups.length > 0"
          class="mx-2 my-3"
        ></v-divider>
      </div>

      <!-- Dynamic Navigation Groups -->
      <div
        v-for="group in navigationGroups"
        :key="group.title"
        class="navigation-group-section"
      >
        <!-- Group Header -->
        <v-list-item
          @click="
            getGroupExpansion(group.title).value = !getGroupExpansion(
              group.title
            ).value
          "
          class="mb-1 rounded-lg group-header"
          :prepend-icon="group.icon"
          :append-icon="
            getGroupExpansion(group.title).value
              ? 'mdi-chevron-up'
              : 'mdi-chevron-down'
          "
        >
          <v-list-item-title class="font-weight-medium">
            {{ group.title }}
          </v-list-item-title>
        </v-list-item>

        <!-- Collapsible Children -->
        <v-expand-transition>
          <div
            v-show="getGroupExpansion(group.title).value"
            class="group-children"
          >
            <v-list-item
              v-for="child in group.children"
              :key="child.title"
              @click="navigateTo(child.route)"
              class="mb-1 rounded-lg ml-4"
              :class="{ 'v-list-item--active': isRouteActive(child.route) }"
              :prepend-icon="child.icon"
            >
              <v-list-item-title class="font-weight-medium">
                {{ child.title }}
              </v-list-item-title>
            </v-list-item>
          </div>
        </v-expand-transition>
      </div>
    </v-list>

    <!-- Sidebar Footer -->
    <template v-slot:append>
      <v-divider class="mx-4 mb-2"></v-divider>

      <!-- Logout Button -->
      <v-list class="pa-2">
        <v-list-item
          @click="handleLogout"
          class="mb-2 rounded-lg logout-button"
          prepend-icon="mdi-logout"
        >
          <v-list-item-title class="font-weight-medium">
            Logout
          </v-list-item-title>
        </v-list-item>
      </v-list>

      <!-- Version Info -->
      <v-list-item class="pa-4">
        <v-list-item-content>
          <v-list-item-subtitle class="text-caption grey--text text-center">
            CSU LOST AND FOUND v1.0
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.v-navigation-drawer {
  /* Remove static background so Vuetify theme color applies */
  z-index: 1000; /* Ensure sidebar is above other content */
}

.sidebar-full-height {
  height: 100vh !important;
  top: 0 !important;
  left: 0 !important;
  position: fixed !important;
}

.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.v-list-group__items {
  background-color: rgba(0, 0, 0, 0.02);
}

.rounded-lg {
  border-radius: 8px !important;
}

.logout-button {
  color: rgb(var(--v-theme-error)) !important;
}

.logout-button:hover {
  background-color: rgba(var(--v-theme-error), 0.1) !important;
}

.admin-controls-section,
.organization-controls-section,
.navigation-group-section,
.individual-nav-section {
  margin-bottom: 8px;
}

.group-header {
  background-color: rgba(var(--v-theme-surface), 0.5) !important;
  font-weight: 500;
}

.group-header:hover {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.admin-children,
.organization-children,
.group-children {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 4px 0;
}
</style>
