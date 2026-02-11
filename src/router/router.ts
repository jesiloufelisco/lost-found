import { setupLayouts } from 'virtual:generated-layouts';
import { createRouter, createWebHistory } from 'vue-router';

import Hero from '@/pages/index.vue';
import Auth from '@/pages/Auth.vue';
import Home from '@/pages/Home.vue';
import NotFound from '@/pages/NotFound.vue';
import ForbiddenView from '@/pages/ForbiddenView.vue';

import DashboardView from '@/pages/admin/DashboardView.vue';
import ProfilesView from '@/pages/ProfilesView.vue';

import UserManagement from '@/pages/admin/UserManagement.vue';
import RolePagesView from '@/pages/admin/RolePagesView.vue';
import SupportInboxView from '@/pages/admin/SupportInboxView.vue';
// TODO: Add these components when they're created
// import UserManagementView from '@/pages/admin/UserManagementView.vue';
// import RolePagesView from '@/pages/admin/RolePagesView.vue';

/**
 * Route definitions for the application
 */
const routes = setupLayouts([
  {
    path: '/',
    component: Hero
  },
  {
    path: '/auth',
    component: Auth,
  },
  {
    path: '/home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/profiles',
    component: ProfilesView,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/users',
    component: UserManagement,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/roles',
    component: RolePagesView,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/support-inbox',
    component: SupportInboxView,
    meta: { requiresAuth: true }
  },


  // TODO: Uncomment when components are created
  // {
  //   path: '/usermanagement',
  //   component: UserManagementView,
  //   meta: { requiresAuth: true }
  // },
  // {
  //   path: '/rolepages',
  //   component: RolePagesView,
  //   meta: { requiresAuth: true }
  // },
  {
    path: '/forbidden',
    component: ForbiddenView,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
  },
]);

/**
 * Create and configure the router instance
 */
export const createAppRouter = () => {
  return createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
  });
};
