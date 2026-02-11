export interface NavigationItem {
  title: string
  icon: string
  route: string
  selected?: boolean
  permission?: string // Optional permission key for role-based access
}

export interface NavigationGroup {
  title: string
  icon: string
  permission?: string // Optional permission key for the entire group
  children: NavigationItem[]
}

// Individual navigation items (non-grouped)
export const individualNavItems: NavigationItem[] = [
  {
    title: 'Home',
    icon: 'mdi-home',
    route: '/home',
    permission: 'app.home.access'
  },
  {
    title: 'Profiles',
    icon: 'mdi-account',
    route: '/profiles',
    permission: 'app.profiles.access'
  },
   {
        title: 'Support Inbox',
        icon: 'mdi-inbox',
        route: '/admin/support-inbox',
        permission: 'admin.support.manage'
      }
]

// Grouped navigation items
export const navigationConfig: NavigationGroup[] = [
  {
    title: 'Admin',
    icon: 'mdi-cog',
    permission: 'admin.access',
    children: [
      {
        title: 'Dashboard',
        icon: 'mdi-view-dashboard',
        route: '/admin/dashboard',
        permission: 'admin.dashboard.view'
      },
      {
        title: 'User Management',
        icon: 'mdi-account-multiple',
        route: '/admin/users',
        permission: 'admin.users.manage'
      },
      {
        title: 'Role Pages',
        icon: 'mdi-account-key',
        route: '/admin/roles',
        permission: 'admin.roles.manage'
      }

    ]
  }
]

// Helper function to get all permissions from navigation config
export const getAllPermissions = (): string[] => {
  const permissions: string[] = []

  // Get permissions from individual nav items
  individualNavItems.forEach(item => {
    if (item.permission) {
      permissions.push(item.permission)
    }
  })

  // Get permissions from grouped nav items
  navigationConfig.forEach(group => {
    if (group.permission) {
      permissions.push(group.permission)
    }

    group.children.forEach(item => {
      if (item.permission) {
        permissions.push(item.permission)
      }
    })
  })

  return [...new Set(permissions)] // Remove duplicates
}

// Helper function to get navigation items with selected state
export const getNavigationWithSelection = (selectedPermissions: string[] = []): { individual: NavigationItem[], grouped: NavigationGroup[] } => {
  const individual = individualNavItems.map(item => ({
    ...item,
    selected: selectedPermissions.includes(item.permission || item.route)
  }))

  const grouped = navigationConfig.map(group => ({
    ...group,
    children: group.children.map(item => ({
      ...item,
      selected: selectedPermissions.includes(item.permission || item.route)
    }))
  }))

  return { individual, grouped }
}
