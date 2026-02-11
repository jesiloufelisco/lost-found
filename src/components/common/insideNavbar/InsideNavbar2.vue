<script lang="ts" setup>
  import type { UIConfig, LogoConfig } from '@/controller/landingController'
  import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from '@/composables/useTheme'
  import { useDisplay } from 'vuetify'
  import { useAuthUserStore } from '@/stores/authUser'
  import { useUserRolesStore } from '@/stores/roles'
  import { getEmailInitials } from '@/utils/helpers'
  import { navigationConfig, individualNavItems } from '@/utils/navigation'
  import { useNotifications } from '@/composables/useNotifications'
  import NotificationDialog from '@/pages/student/components/NotifDialog.vue'

  interface Props {
    config?: UIConfig
  }

  const props = defineProps<Props>()
  const router = useRouter()
  const authStore = useAuthUserStore()
  const rolesStore = useUserRolesStore()

  // Computed property to check if user is admin - must be defined early
  const isAdmin = computed(() => {
    const roleId = authStore.userData?.user_metadata?.role ||
                   authStore.userData?.app_metadata?.role;
    return roleId === 1; // Assuming role ID 1 is admin
  });

  // Responsive breakpoints
  const { mobile } = useDisplay()

  // Mobile drawer state
  const drawer = ref(false)
  const userMenu = ref(false)

  // Control admin group expansion - make it persistent
  const adminGroupExpanded = ref(true)

  // Control organization group expansion - make it persistent
  const organizationGroupExpanded = ref(true)

  // Control my account group expansion - make it persistent
  const myAccountGroupExpanded = ref(true)

  // Theme management
  const { toggleTheme: handleToggleTheme, getCurrentTheme, isLoadingTheme } = useTheme()

  // Notifications management
  const {
    unreadCount,
    hasUnreadNotifications,
    loadMyNotifications,
    setupRealtimeNotifications,
    teardownRealtimeNotifications,
    userNotificationsStore
  } = useNotifications()

  // Notification dialog state
  const showNotificationDialog = ref(false)

  const toggleNotifications = () => {
    showNotificationDialog.value = true
  }

  const handleMarkGlobalAsRead = (id: number) => {
    userNotificationsStore.markAsRead(id)
  }

  const handleClearAllNotifications = () => {
    // Mark all notifications as read for current user
    if (authStore.userData?.id) {
      userNotificationsStore.markAllAsRead(authStore.userData.id)
    }
  }

  // Scroll detection for mobile drawer auto-close
  let lastScrollY = ref(0)
  let ticking = ref(false)

  const handleScroll = () => {
    if (!ticking.value) {
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY

        // Close mobile drawer when scrolling down
        if (mobile.value && drawer.value && currentScrollY > lastScrollY.value) {
          drawer.value = false
        }

        lastScrollY.value = currentScrollY
        ticking.value = false
      })
      ticking.value = true
    }
  }

  // Add scroll listener on mount, remove on unmount
  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    lastScrollY.value = window.scrollY
    // Fetch roles for role description
    rolesStore.fetchRoles()

    // Setup notifications if user is authenticated
    if (authStore.userData && !isAdmin.value) {
      loadMyNotifications()
      setupRealtimeNotifications()
    }
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
    teardownRealtimeNotifications()
  })

  // Watch for auth changes to setup/cleanup notifications
  watch(
    () => authStore.userData,
    async (userData) => {
      if (userData && !isAdmin.value) {
        await loadMyNotifications()
        setupRealtimeNotifications()
      } else {
        teardownRealtimeNotifications()
      }
    },
    { immediate: true }
  )

  // Watch for route changes and keep admin group expanded if we're on an admin route
  watch(
    () => router.currentRoute.value.path,
    (newPath) => {
      if (
        newPath === "/dashboard" ||
        newPath === "/usermanagement" ||
        newPath === "/rolepages"
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

  const navbarConfig = computed(() => props.config?.navbar)

  // Theme toggle computed properties
  const currentTheme = computed(() => getCurrentTheme())
  const themeIcon = computed(() => {
    return currentTheme.value === 'dark' ? 'mdi-white-balance-sunny' : 'mdi-weather-night'
  })
  const themeTooltip = computed(() => {
    return `Switch to ${currentTheme.value === 'dark' ? 'light' : 'dark'} theme`
  })

  // User initials for avatar
  const userInitials = computed(() => {
    return getEmailInitials(authStore.userEmail)
  })

  // Computed property for panel title
  const panelTitle = computed(() => {
    return isAdmin.value ? 'Admin Panel' : 'Student Panel';
  });

  // Get user role description
  const userRoleDescription = computed(() => {
    const roleId = authStore.userData?.user_metadata?.role ||
                   authStore.userData?.app_metadata?.role;
    if (!roleId) return null;
    const role = rolesStore.roles.find(r => r.id === roleId);
    return role?.title || `Role ID: ${roleId}`;
  });

  // Get navigation groups from shared config, filtered by user role
  const navigationGroups = computed(() => {
    if (isAdmin.value) {
      return navigationConfig;
    }
    // Filter out admin-only groups for non-admin users
    return navigationConfig.filter(group => group.title !== 'Admin');
  });

  function toggleTheme () {
    handleToggleTheme()
  }

  async function handleLogout () {
    try {
      userMenu.value = false // Close dropdown menu
      await authStore.signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

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
    return router.currentRoute.value.path === routePath;
  };
</script>

<template>
  <div v-if="config?.showNavbar && navbarConfig">
    <!-- App Bar for Desktop -->
    <v-app-bar
      app
      :elevation="navbarConfig.elevation"
      density="comfortable"
      flat
      scroll-behavior="elevate"
      scroll-threshold="50"
      class="navbar-gradient"
    >
      <!-- Logo and Title Section -->
      <template #prepend>
        <!-- Logo Image with Icon Fallback -->
        <template v-if="navbarConfig.logo?.src">
          <v-img
            :src="navbarConfig.logo.src"
            :alt="navbarConfig.logo.alt"
            :width="navbarConfig.logo.width || 40"
            :height="navbarConfig.logo.height || 40"
            class="me-3"
            contain
          >
            <template #error>
              <!-- Fallback to avatar with icon if image fails to load -->
              <v-avatar
                class="me-3"
                size="40"
                :color="navbarConfig.color === 'transparent' ? 'primary' : 'primary-darken-1'"
              >
                <v-icon
                  :icon="navbarConfig.icon"
                  size="24"
                  color="white"
                />
              </v-avatar>
            </template>
          </v-img>
        </template>
        <template v-else>
          <!-- Default avatar with icon when no logo is configured -->
          <v-avatar
            class="me-3"
            size="40"
            :color="navbarConfig.color === 'transparent' ? 'primary' : 'primary-darken-1'"
          >
            <v-icon
              :icon="navbarConfig.icon"
              size="24"
              color="white"
            />
          </v-avatar>
        </template>

        <div class="d-flex flex-column">
          <span class="text-h6 font-weight-bold text-white">
            {{ navbarConfig.title }}
          </span>
          <span class="text-caption text-white">
            Modern Design
          </span>
        </div>
      </template>

      <v-spacer />

      <!-- Desktop Actions -->
      <template #append>
        <div class="d-none d-md-flex align-center">
          <!-- Action Buttons Container -->
          <div class="d-flex align-center">
            <!-- Theme Toggle with Badge -->
            <v-badge
              :content="currentTheme.charAt(0).toUpperCase()"
              color="secondary"
              offset-x="8"
              offset-y="8"
            >
              <v-btn
                :loading="isLoadingTheme"
                size="large"
                variant="text"
                rounded="xl"
                :aria-label="themeTooltip"
                class="text-white"
                @click="toggleTheme"
              >
                <v-icon :icon="themeIcon" color="white" />
                <v-tooltip activator="parent" location="bottom">
                  {{ themeTooltip }}
                </v-tooltip>
              </v-btn>
            </v-badge>

            <!-- Notification Bell for Students - beside theme toggle -->
            <v-btn
              v-if="!isAdmin"
              icon
              @click="toggleNotifications"
              :color="hasUnreadNotifications ? 'warning' : 'white'"
              size="large"
              variant="text"
              rounded="xl"
              class="text-white ml-1"
              aria-label="Notifications"
            >
              <v-badge
                :content="unreadCount"
                :model-value="hasUnreadNotifications"
                color="error"
                overlap
              >
                <v-icon color="white">mdi-bell</v-icon>
              </v-badge>
              <v-tooltip activator="parent" location="bottom">
                {{ hasUnreadNotifications ? `${unreadCount} new notifications` : 'No new notifications' }}
              </v-tooltip>
            </v-btn>

            <!-- User Avatar with Dropdown Menu -->
            <v-menu
              v-model="userMenu"
              :close-on-content-click="false"
              location="bottom end"
              offset="8"
            >
              <template #activator="{ props }">
                <v-avatar
                  v-bind="props"
                  size="40"
                  color="primary-lighten-1"
                  class="text-primary-darken-4 font-weight-bold ml-2 cursor-pointer mx-5"
                  aria-label="User menu"
                >
                  {{ userInitials }}
                </v-avatar>
              </template>

              <v-card min-width="200">
                <v-list>
                  <!-- User Info -->
                  <v-list-item>
                    <template #prepend>
                      <v-avatar
                        size="32"
                        color="primary"
                        class="text-white font-weight-bold"
                      >
                        {{ userInitials }}
                      </v-avatar>
                    </template>
                    <v-list-item-title class="font-weight-medium">
                      {{ authStore.userName || 'User' }}
                    </v-list-item-title>
                    <v-list-item-subtitle class="text-caption">
                      {{ authStore.userEmail }}
                    </v-list-item-subtitle>
                    <v-list-item-subtitle v-if="userRoleDescription" class="text-caption mt-1">
                      <v-chip
                        size="x-small"
                        :color="isAdmin ? 'error' : 'primary'"
                        variant="tonal"
                        class="text-caption"
                      >
                        {{ userRoleDescription }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-divider />

                  <!-- Menu Actions -->
                  <v-list-item
                    prepend-icon="mdi-logout"
                    title="Logout"
                    :loading="authStore.loading"
                    @click="handleLogout"
                  />
                </v-list>
              </v-card>
            </v-menu>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <v-btn
          class="d-md-none text-white"
          icon="mdi-menu"
          variant="text"
          @click="drawer = !drawer"
        >
          <v-icon icon="mdi-menu" color="white" />
        </v-btn>
      </template>
    </v-app-bar>

    <!-- Mobile Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      location="end"
      temporary
      width="300"
      class="d-md-none elevation-2"
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
        </v-list-item-content>
      </v-list-item>

      <v-divider class="mx-4"></v-divider>

      <!-- Navigation Menu -->
      <v-list nav class="pa-2">
        <!-- Individual Navigation Items (non-grouped) -->
        <div
          v-if="individualNavItems.length > 0"
          class="individual-nav-section mb-3"
        >
          <v-list-item
            v-for="item in individualNavItems"
            :key="item.title"
            @click="navigateTo(item.route); drawer = false"
            class="mb-1 rounded-lg"
            :class="{ 'v-list-item--active': isRouteActive(item.route) }"
            :prepend-icon="item.icon"
          >
            <v-list-item-title class="font-weight-medium">
              {{ item.title }}
            </v-list-item-title>
          </v-list-item>

          <!-- Divider after individual items -->
          <v-divider class="mx-2 my-3"></v-divider>
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
                @click="navigateTo(child.route); drawer = false"
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

        <!-- Theme Toggle List Item -->
        <v-divider class="mx-2 my-3"></v-divider>

        <!-- Notification Bell for Students (Mobile) -->
        <v-list-item
          v-if="!isAdmin"
          @click="toggleNotifications; drawer = false"
          class="ma-2 rounded-lg"
          prepend-icon="mdi-bell"
        >
          <v-list-item-title class="d-flex align-center">
            <span>Notifications</span>
            <v-badge
              v-if="hasUnreadNotifications"
              :content="unreadCount"
              color="error"
              class="ml-2"
            >
              <span></span>
            </v-badge>
          </v-list-item-title>
        </v-list-item>

        <v-list-item
          :title="themeTooltip"
          :prepend-icon="themeIcon"
          rounded="xl"
          class="ma-2"
          @click="toggleTheme"
        />
      </v-list>

      <!-- Sidebar Footer -->
      <template v-slot:append>
        <v-divider class="mx-4 mb-2"></v-divider>

        <!-- User Info Section -->
        <v-list-item class="pa-4">
          <template #prepend>
            <v-avatar
              size="40"
              color="primary"
              class="text-white font-weight-bold me-3"
            >
              {{ userInitials }}
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium">
            {{ authStore.userName || 'User' }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ authStore.userEmail }}
          </v-list-item-subtitle>
          <v-list-item-subtitle v-if="userRoleDescription" class="text-caption mt-1">
            <v-chip
              size="x-small"
              :color="isAdmin ? 'error' : 'primary'"
              variant="tonal"
              class="text-caption"
            >
              {{ userRoleDescription }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item>

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

    <!-- Notification Dialog -->
    <NotificationDialog
      v-if="!isAdmin"
      v-model="showNotificationDialog"
      :notifications="[]"
      :global-notifications="userNotificationsStore.userNotifications.filter(n => n.id != null).map(n => ({ ...n, type: 'global' }))"
      @mark-global-as-read="handleMarkGlobalAsRead"
      @clear-all="handleClearAllNotifications"
    />
  </div>
</template>

<style scoped>
/* Enhance the app bar with subtle animations */
.v-app-bar {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Gradient effect using primary theme color */
.navbar-gradient {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgba(var(--v-theme-primary), 0.8) 50%,
    rgba(var(--v-theme-primary), 0.9) 100%
  ) !important;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.2);
}

/* Force all text to be white */
.v-app-bar .text-white,
.v-app-bar .text-h6,
.v-app-bar .text-caption {
  color: white !important;
}

/* Force all button text and icons to be white */
.v-app-bar .v-btn,
.v-app-bar .v-btn .v-btn__content,
.v-app-bar .v-icon {
  color: white !important;
}

/* Notification bell animation */
.v-app-bar .v-btn:has(.mdi-bell) {
  animation: bell-shake 3s infinite;
}

@keyframes bell-shake {
  0%, 90%, 100% {
    transform: rotate(0deg);
  }
  2%, 6% {
    transform: rotate(-15deg);
  }
  4%, 8% {
    transform: rotate(15deg);
  }
}

/* Ensure navigation drawer has proper styling */
.v-navigation-drawer .v-list-item-title,
.v-navigation-drawer .v-list-item-subtitle {
  color: inherit !important;
}

/* Smooth drawer animation */
.v-navigation-drawer {
  backdrop-filter: blur(10px);
}

/* Additional styles for mobile sidebar navigation */
.v-navigation-drawer .v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.v-navigation-drawer .v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.v-navigation-drawer .v-list-group__items {
  background-color: rgba(0, 0, 0, 0.02);
}

.v-navigation-drawer .rounded-lg {
  border-radius: 8px !important;
}

.v-navigation-drawer .logout-button {
  color: rgb(var(--v-theme-error)) !important;
}

.v-navigation-drawer .logout-button:hover {
  background-color: rgba(var(--v-theme-error), 0.1) !important;
}

.v-navigation-drawer .admin-controls-section,
.v-navigation-drawer .organization-controls-section,
.v-navigation-drawer .navigation-group-section,
.v-navigation-drawer .individual-nav-section {
  margin-bottom: 8px;
}

.v-navigation-drawer .group-header {
  background-color: rgba(var(--v-theme-surface), 0.5) !important;
  font-weight: 500;
}

.v-navigation-drawer .group-header:hover {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}

.v-navigation-drawer .admin-children,
.v-navigation-drawer .organization-children,
.v-navigation-drawer .group-children {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 4px 0;
}
</style>
