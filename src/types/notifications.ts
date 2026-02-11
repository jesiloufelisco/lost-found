// notifications.ts - Type definitions for notifications system
export interface Notification {
  id?: number;
  created_at?: string;
  title?: string;
  description?: string;
}

export interface NotificationInput {
  title: string;
  description?: string;
}

export interface UserNotification {
  id?: number;
  created_at?: string;
  user_id?: string;
  notification_id?: number;
  is_read?: boolean;
  // Joined notification data
  notification?: Notification;
}

export interface UserNotificationInput {
  user_id: string;
  notification_id: number;
  is_read?: boolean;
}

export interface NotificationWithUserData extends Notification {
  user_notifications?: UserNotification[];
  recipient_count?: number;
  unread_count?: number;
}

// API Response types
export interface NotificationResponse {
  data?: Notification | Notification[];
  error?: any;
  success?: boolean;
}

export interface UserNotificationResponse {
  data?: UserNotification | UserNotification[];
  error?: any;
  success?: boolean;
  count?: number;
}

// Notification status and priority types
export type NotificationStatus = 'draft' | 'sent' | 'scheduled' | 'archived';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Extended notification interface for future enhancements
export interface ExtendedNotification extends Notification {
  priority?: NotificationPriority;
  status?: NotificationStatus;
  scheduled_at?: string;
  expires_at?: string;
  action_url?: string;
  action_text?: string;
  category?: string;
  author_id?: string;
}
