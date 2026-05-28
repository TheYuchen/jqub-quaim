import { useEffect, useRef, useState } from "react";
import { Cloud, LogIn, LogOut, User } from "lucide-react";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { bumpPluginsRev, bumpSessionRev } from "../lib/userId";

/**
 * Compact user-state control in the TopBar:
 *   * Not logged in → "Sign in" button that kicks off the OAuth dance
 *     (full-page navigation, since OAuth needs a top-level redirect).
 *   * Logged in     → avatar / name pill that toggles a dropdown with
 *     a logout button and a persistence-status hint.
 *
 * Hidden entirely when the server reports oauth_enabled=false (local
 * dev without HF metadata).
 */
export function AuthButton({ mobile = false }: { mobile?: boolean } = {}) {
  const session = useApp((s) => s.session);
  const authStatus = useApp((s) => s.authStatus);
  const setSession = useApp((s) => s.setSession);
  const setPlugins = useApp((s) => s.setPlugins);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape close the dropdown.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // While we haven't probed /api/auth/status yet, reserve the slot
  // with an invisible placeholder so the TopBar's right cluster
  // doesn't shift when the button materialises. Once the probe
  // resolves we either render the real button or vanish for good
  // (oauth_enabled=false in dev).
  if (authStatus === null) {
    return <span className="inline-block w-[7.5rem] h-7" aria-hidden />;
  }
  if (!authStatus.oauth_enabled) return null;

  if (!session) {
    return (
      <a
        href={api.authLoginUrl()}
        // Slight visual lift vs btn-ghost so the value of signing in
        // (persistence) is more discoverable. Same height as
        // surrounding controls; just a colored border + soft tint.
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:border-accent text-xs font-medium"
        title="Sign in with your Hugging Face account to persist plugins across container restarts and devices"
        aria-label="Sign in with Hugging Face to keep plugins across restarts and devices"
        onClick={() => {
          // Show a brief 'redirecting' UI by setting a session-storage
          // flag the next page render reads. Without this, slow HF
          // redirects (cold pods can take 1-3s) leave the user
          // wondering if their click registered.
          try {
            sessionStorage.setItem("quda.loggingIn", "1");
          } catch {
            /* storage blocked is fine */
          }
        }}
      >
        <LogIn className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign in to keep plugins</span>
        <span className="sm:hidden">Sign in</span>
      </a>
    );
  }

  const handleLogout = async () => {
    try {
      await api.authLogout();
    } catch {
      /* network errors are fine — we still clear local state */
    }
    setSession(null);
    setPlugins([]); // Visible plugins were tied to the session; clear.
    setMenuOpen(false);
    bumpPluginsRev();
    bumpSessionRev();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-edge bg-surface/60 text-mute hover:text-ink hover:border-accent/40 text-xs"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={`Signed in as ${session.username}`}
      >
        {session.avatar_url ? (
          <img
            src={session.avatar_url}
            alt=""
            className="w-5 h-5 rounded-full bg-surface object-cover"
            aria-hidden
            onError={(e) => {
              // Avatar URL 404 → swap in the User icon fallback by
              // hiding the broken image. Without this the user sees
              // a broken-image glyph.
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <User className="w-3.5 h-3.5" aria-hidden />
        )}
        {!mobile && (
          <span className="text-ink font-medium max-w-[10ch] truncate">
            {session.username}
          </span>
        )}
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-64 panel-alt shadow-lg z-50 text-xs"
        >
          <div className="px-3 py-2 border-b border-edge">
            <div className="text-mute text-[10px] uppercase tracking-wider">
              Signed in as
            </div>
            <div className="text-ink font-medium truncate">
              {session.username}
            </div>
          </div>
          <div className="px-3 py-2 border-b border-edge text-mute leading-relaxed space-y-2">
            <div>
              {session.persistence_enabled ? (
                <>
                  <Cloud className="w-3 h-3 inline-block mr-1 -mt-0.5 text-accent2" />
                  Your plugins are saved under{" "}
                  <span className="font-mono break-all">
                    {session.user_data_repo}/users/{session.username}/
                  </span>
                  {" "}— a private folder only you and the QuDA server
                  can read. They survive container restarts and follow
                  you to any device you sign in on.
                </>
              ) : (
                <span className="text-warn">
                  Persistence is not configured on this deployment, so
                  your plugins will still vanish on container restart.
                </span>
              )}
            </div>
            <div className="text-[10px] text-mute/70 leading-snug">
              Plugins you uploaded before signing in remain under your
              anonymous browser id — sign out to access them.
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 hover:bg-surface text-ink flex items-center gap-2"
            role="menuitem"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
