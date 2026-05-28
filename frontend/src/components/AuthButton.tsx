import { useEffect, useRef, useState } from "react";
import { Cloud, LogIn, LogOut, User } from "lucide-react";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { bumpPluginsRev } from "../lib/userId";

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

  // Click-outside closes the dropdown.
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Don't render anything if this deployment can't do OAuth at all
  // (e.g. local dev without README hf_oauth metadata).
  if (!authStatus?.oauth_enabled) return null;

  if (!session) {
    return (
      <a
        href={api.authLoginUrl()}
        className="btn-ghost"
        title="Sign in with your Hugging Face account to keep plugins across devices and restarts"
        aria-label="Sign in with Hugging Face"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign in</span>
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
                  Plugins you upload are saved to your private HF Datasets
                  repo (<span className="font-mono">{session.user_data_repo}</span>),
                  so they survive container restarts.
                </>
              ) : (
                <span className="text-warn/80">
                  Persistence is not configured on this deployment, so
                  your plugins will still vanish on container restart.
                </span>
              )}
            </div>
            <div className="text-[10px] text-mute/70 leading-snug">
              If you uploaded plugins before signing in, they're still
              under your anonymous browser id — sign out to access them.
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
