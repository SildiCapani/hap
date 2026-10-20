import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import type { Reminder } from "./reminders";

if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

export async function askPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      if (typeof Notification === "undefined") return false;
      if (Notification.permission === "granted") return true;
      return (await Notification.requestPermission()) === "granted";
    }
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "Erinnerungen",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: "#F07B83",
      });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

let webTimers: ReturnType<typeof setTimeout>[] = [];
let running: Promise<void> = Promise.resolve();

export function schedule(list: Reminder[]) {
  running = running.catch(() => {}).then(() => apply(list));
  return running;
}

async function apply(list: Reminder[]) {
  if (Platform.OS === "web") {
    webTimers.forEach(clearTimeout);
    webTimers = [];
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Browsers only deliver these while Hap is open in a tab.
    for (const r of list.filter((x) => x.at - Date.now() < 24 * 3600 * 1000))
      webTimers.push(
        setTimeout(() => {
          try {
            new Notification(r.title, { body: r.body, icon: "/favicon.ico", tag: r.id });
          } catch {
            // Some mobile browsers only allow notifications from a service worker.
          }
        }, r.at - Date.now()),
      );
    return;
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of list)
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: "default",
      },
    });
}

// On the web this uses the Vibration API where the browser supports it.
export function tap(kind: "light" | "medium" | "success" | "heavy" = "light") {
  void (kind === "success"
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(
        kind === "heavy"
          ? Haptics.ImpactFeedbackStyle.Heavy
          : kind === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
      )
  ).catch(() => {});
}
