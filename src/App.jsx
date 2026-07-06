import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AuthScreen from "./AuthScreen";
import MainApp from "./MainApp";
import AdminPanel from "./AdminPanel";
import { registerPush } from "./pushNotifications";

const isAdminRoute = new URLSearchParams(window.location.search).get("admin") === "true";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load profile:", error);
          setProfileError(error.message);
        }
        setProfile(data ?? null);
        if (data?.id) registerPush(data.id);
      });
  }, [session?.user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowAdmin(false);
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-sm font-mono">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-mono text-center">
        <p className="text-white/40 text-sm mb-3">
          {profileError ? "Something went wrong" : "Setting up your account..."}
        </p>
        {profileError && (
          <>
            <p className="text-[#ff3b3b] text-xs mb-4 max-w-xs">{profileError}</p>
            <button onClick={handleLogout} className="text-white/50 text-xs underline">
              Sign out and try again
            </button>
          </>
        )}
      </div>
    );
  }

  // Dedicated admin website — visiting the URL with ?admin=true goes straight
  // to the admin console after login, instead of the small/big game.
  if (isAdminRoute) {
    if (profile.role !== "admin") {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-mono text-center">
          <p className="text-[#ff3b3b] text-sm font-bold mb-2">Not authorized</p>
          <p className="text-white/40 text-xs mb-6">This account doesn't have admin access.</p>
          <button
            onClick={handleLogout}
            className="text-white/50 text-xs underline"
          >
            Sign out
          </button>
        </div>
      );
    }
    return <AdminPanel onClose={handleLogout} onSignOut={handleLogout} standalone />;
  }

  return (
    <>
      <MainApp profile={profile} onLogout={handleLogout} onOpenAdmin={() => setShowAdmin(true)} />
      {showAdmin && profile.role === "admin" && (
        <AdminPanel onClose={() => setShowAdmin(false)} onSignOut={handleLogout} />
      )}
    </>
  );
}

