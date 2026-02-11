// Utilities
import { createPinia } from 'pinia'

// Export stores
export { useNotificationsStore } from './notificationsData'
export { useUserNotificationsStore } from './userNotificationsData'
export { useAuthUserStore } from './authUser'
export { useSidebarStore } from './sidebar'

export default createPinia()
