/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Analytics} from '@logging/analytics';
import {UserNotification} from '@messaging/user_notification';
import {UserNotificationListener} from '@messaging/user_notification_listener';

/**
 * A utility class to collect and display notifications to the user.
 * Notifications are displayed via a snack bar.
 */
class UserNotifierImpl {
  private notifications: UserNotification[] = [];
  private notificationListener: UserNotificationListener | undefined;

  setNotificationListener(snackBarOpener: UserNotificationListener) {
    this.notificationListener = snackBarOpener;
  }

  add(notification: UserNotification): this {
    this.notifications.push(notification);
    return this;
  }

  notify() {
    if (this.notifications.length === 0) return;
    this.notifications.forEach((notif) => {
      Analytics.UserNotification.logUserWarning(
        notif.descriptor,
        notif.message,
      );
    });
    this.notificationListener?.onNotifications(this.notifications);
    this.notifications = [];
  }
}

/**
 * A utility to collect and display notifications to the user.
 */
export const UserNotifier = new UserNotifierImpl();
