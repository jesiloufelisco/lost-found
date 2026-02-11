<script setup lang="ts">
import InnerLayoutWrapper from '@/layouts/InnerLayoutWrapper.vue';
import UsersTable from './components/UsersTable.vue';
</script>
<template>
<InnerLayoutWrapper #content>
  <div class="pa-4">
    <UsersTable />
  </div>
</InnerLayoutWrapper>
</template>
