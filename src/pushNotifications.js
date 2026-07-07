import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabaseClient";

// Registers this device for push notifications and saves the token
// against the currently signed-in user. Safe to call multiple times.
export async function registerPush(userId) {
  if (!userId) return;

  try {
    // Android: create a HIGH importance channel so notifications pop up
    // as a heads-up banner instead of landing silently in the shade.
    await PushNotifications.createChannel({
      id: "default",
      name: "Default",
      description: "General notifications",
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,
      vibration: true,
    }).catch(() => {}); // no-op on platforms that don't support channels (e.g. web)

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

