import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabaseClient";

// Registers this device for push notifications and saves the token
// against the currently signed-in user. Safe to call multiple times.
export async function registerPush(userId) {
  if (!userId) return;

  try {
    const permStatus = await PushNotifications.checkPermissions();

    let granted = permStatus.receive === "granted";
    if (!granted) {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === "granted";
    }
    if (!granted) return;

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      const { error } = await supabase
        .from("push_tokens")
        .upsert({ user_id: userId, token: token.value }, { onConflict: "token" });
      if (error) console.error("Failed to save push token:", error);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });
  } catch (e) {
    // Push notifications aren't available (e.g. running in a plain browser
    // instead of the installed app) — fail silently, this is expected there.
    console.log("Push notifications unavailable:", e?.message);
  }
}
