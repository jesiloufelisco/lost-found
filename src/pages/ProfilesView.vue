<script setup lang="ts">
import InnerLayoutWrapper from '@/layouts/InnerLayoutWrapper.vue';
import ProfilesWidget from '@/pages/admin/components/ProfilesWidget.vue';
import ProfileFormUpdate from '@/pages/admin/components/ProfileFormUpdate.vue';

// Handle profile widget events
const handleEditProfile = () => {
  console.log('Edit profile clicked')
  // Focus on the form section
  document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth' })
}

const handleViewPermissions = () => {
  console.log('View permissions clicked')
  // TODO: Navigate to permissions page or open modal
}
</script>

<template>
  <InnerLayoutWrapper #content>
   <v-container fluid class="pa-0">
     <div class="pa-4 pa-md-6" >
      <!-- Page Header -->
      <div class="text-start mb-8">
        <h1 class="text-h3 text-md-h2 font-weight-bold text-primary mb-2">
          User Profile
        </h1>
        <p class="text-h6 text-md-h5 text-medium-emphasis">
          View and manage your profile information
        </p>
      </div>

      <!-- Main Content Grid -->
      <v-row>
        <!-- Profile Widget Column -->
        <v-col cols="12" md="6" lg="4">
          <ProfilesWidget
            @edit-profile="handleEditProfile"
            @view-permissions="handleViewPermissions"
          />
        </v-col>

        <!-- Profile Form Column -->
        <v-col cols="12" md="6" lg="8">
          <ProfileFormUpdate />
        </v-col>
      </v-row>


    </div>
   </v-container>
  </InnerLayoutWrapper>
</template>
