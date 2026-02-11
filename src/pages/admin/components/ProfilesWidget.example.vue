<!-- Example usage of ProfilesWidget in a dashboard -->
<!-- This shows how to integrate the ProfilesWidget component -->

<template>
  <div class="dashboard-with-profile">
    <!-- Main Dashboard Content -->
    <div class="dashboard-content">
      <h1>Admin Dashboard</h1>
      <p>Main dashboard content goes here...</p>
    </div>

    <!-- Sidebar with Profile Widget -->
    <div class="sidebar">
      <ProfilesWidget
        @edit-profile="handleEditProfile"
        @view-permissions="handleViewPermissions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ProfilesWidget from '@/pages/admin/components/ProfilesWidget.vue'

// Handle profile widget events
const handleEditProfile = () => {
  console.log('Edit profile clicked')
  // Navigate to profile edit page or open modal
}

const handleViewPermissions = () => {
  console.log('View permissions clicked')
  // Navigate to permissions page or open modal
}
</script>

<style scoped>
.dashboard-with-profile {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.dashboard-content {
  flex: 1;
}

.sidebar {
  width: 400px;
  flex-shrink: 0;
}
</style>
