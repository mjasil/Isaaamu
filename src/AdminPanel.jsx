import { useState, useEffect } from "react";
import { Shield, Users, FileText, BarChart3, LogOut, UserPlus, Link as LinkIcon, Bell } from "lucide-react";
import { supabase } from "./supabaseClient";

export default function AdminPanel({ onClose, onSignOut, standalone }) {
  const [tab, setTab] = useState("users"); // users | create | content | stats | notify
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState({ total: 0, small: 0, big: 0 });
  const [loading, setLoading] = useState(true);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: profiles }, { data: appContent }, { data: history }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("app_content").select("*"),
      supabase.from("result_history").select("result"),
    ]);
    setUsers(profiles ?? []);
    setContent(appContent ?? []);
    const small = (history ?? []).filter((h) => h.result === "small").length;
    const big = (history ?? []).filter((h) => h.result === "big").length;
    setStats({ total: (history ?? []).length, small, big });
    setLoading(false);
  }

  async function toggleAdmin(user) {
    const newRole = user.role === "admin" ? "user" : "admin";
    await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
    loadAll();
  }

  async function updateContentValue(key, value) {
    await supabase.from("app_content").upsert({ key, value }, { onConflict: "key" });
    loadAll();
  }

  async function sendNotification(e) {
    e.preventDefault();
    setNotifyMsg("");
    if (!notifyTitle.trim() || !notifyBody.trim()) {
      setNotifyMsg("Title and message are required.");
      return;
    }
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { title: notifyTitle.trim(), body: notifyBody.trim() },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setSending(false);
    if (error || data?.error) {
      setNotifyMsg(data?.error || error.message || "Failed to send.");
    } else {
      setNotifyMsg(`Sent to ${data?.sent ?? 0} device(s).`);
      setNotifyTitle("");
      setNotifyBody("");
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setCreateMsg("");
    if (!newUsername.trim() || newPassword.length < 6) {
      setCreateMsg("Username required, password needs 6+ characters.");
      return;
    }
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { username: newUsername.trim(), password: newPassword },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setCreating(false);
    if (error || data?.error) {
      setCreateMsg(data?.error || error.message || "Failed to create account.");
    } else {
      setCreateMsg(`Account "${newUsername}" created.`);
      setNewUsername("");
      setNewPassword("");
      loadAll();
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-[60] font-mono overflow-y-auto">
      <div className="max-w-md mx-auto p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#3b82ff]" />
            <h1 className="text-white text-lg font-bold">Admin Panel</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onSignOut} className="text-white/50 hover:text-white p-2" title="Sign out">
              <LogOut size={18} />
            </button>
            {!standalone && (
              <button onClick={onClose} className="text-white/50 hover:text-white text-sm px-3 py-1 border border-white/20 rounded-md">
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { id: "users", label: "Users", icon: Users },
            { id: "create", label: "Create", icon: UserPlus },
            { id: "content", label: "Content", icon: FileText },
            { id: "stats", label: "Stats", icon: BarChart3 },
            { id: "notify", label: "Notify", icon: Bell },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: tab === id ? "linear-gradient(90deg, #3b82ff, #0037a8)" : "rgba(255,255,255,0.06)",
                color: tab === id ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-white/40 text-sm text-center py-10">Loading...</p>
        ) : (
          <>
            {tab === "users" && (
              <div className="space-y-2">
                {users.length === 0 && <p className="text-white/40 text-sm">No users yet.</p>}
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-white text-sm font-semibold">{u.username}</p>
                      <p className="text-white/40 text-[10px] uppercase tracking-wide">{u.role}</p>
                    </div>
                    <button
                      onClick={() => toggleAdmin(u)}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#3b82ff]/40 text-[#8ab4ff]"
                    >
                      {u.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === "create" && (
              <form onSubmit={createUser} className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide">Username</label>
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoCapitalize="none"
                    placeholder="new_user"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide">Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60"
                  />
                </div>
                {createMsg && <p className="text-[#8ab4ff] text-xs">{createMsg}</p>}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold text-sm py-2.5 rounded-lg disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #3b82ff, #0037a8)" }}
                >
                  <UserPlus size={15} />
                  {creating ? "Creating..." : "Create account"}
                </button>
              </form>
            )}

            {tab === "content" && (
              <div className="space-y-3">
                <div className="border border-[#3b82ff]/30 rounded-lg p-3">
                  <label className="text-[#8ab4ff] text-[10px] uppercase tracking-wide flex items-center gap-1">
                    <LinkIcon size={11} /> Fixed Website Link
                  </label>
                  <input
                    defaultValue={content.find((c) => c.key === "fixed_link")?.value ?? ""}
                    onBlur={(e) => updateContentValue("fixed_link", e.target.value.trim())}
                    placeholder="https://example.com"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60"
                  />
                  <p className="text-white/30 text-[10px] mt-1">
                    Users tap one button to open this exact link — no typing needed on their end.
                  </p>
                </div>

                {content.filter((c) => c.key !== "fixed_link").map((c) => (
                  <div key={c.key}>
                    <label className="text-white/40 text-[10px] uppercase tracking-wide">{c.key}</label>
                    <input
                      defaultValue={c.value}
                      onBlur={(e) => updateContentValue(c.key, e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60"
                    />
                  </div>
                ))}
                <p className="text-white/30 text-[10px]">Edits save when you tap away from a field.</p>
              </div>
            )}

            {tab === "stats" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-white text-xl font-bold">{stats.total}</p>
                  <p className="text-white/40 text-[10px] uppercase mt-1">Total rolls</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-[#5da9ff] text-xl font-bold">{stats.small}</p>
                  <p className="text-white/40 text-[10px] uppercase mt-1">Small</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-[#ffb85c] text-xl font-bold">{stats.big}</p>
                  <p className="text-white/40 text-[10px] uppercase mt-1">Big</p>
                </div>
                <p className="col-span-3 text-white/30 text-[10px] text-center mt-2">
                  Stats reflect real outcomes — results are never overridden here.
                </p>
              </div>
            )}

            {tab === "notify" && (
              <form onSubmit={sendNotification} className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide">Title</label>
                  <input
                    value={notifyTitle}
                    onChange={(e) => setNotifyTitle(e.target.value)}
                    placeholder="e.g. New update"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wide">Message</label>
                  <textarea
                    value={notifyBody}
                    onChange={(e) => setNotifyBody(e.target.value)}
                    placeholder="What do you want to tell everyone?"
                    rows={3}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm mt-1 outline-none focus:border-[#3b82ff]/60 resize-none"
                  />
                </div>
                {notifyMsg && <p className="text-[#8ab4ff] text-xs">{notifyMsg}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold text-sm py-2.5 rounded-lg disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #3b82ff, #0037a8)" }}
                >
                  <Bell size={15} />
                  {sending ? "Sending..." : "Send to all users"}
                </button>
                <p className="text-white/30 text-[10px] text-center">
                  Goes out to every device that has the app installed and notifications enabled.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
