import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Facebook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { loginWithFacebook, loginWithFacebookCode, getToken, clearToken, isAccessTokenValid } from "../services/api";

const FB_GRAPH_VERSION = "v22.0";
/**
 * Only `public_profile` here — avoids "Invalid Scopes: email" until you add **email**
 * under Meta → your app → Facebook Login → **Permissions** (or App Review → Permissions).
 * The backend still works without email (it uses a placeholder address tied to your Meta user id).
 */
const FB_LOGIN_SCOPES = "public_profile";

const LOGIN_ROUTE_PATH = "/login";

/**
 * Full-page OAuth. Uses **authorization code** (`response_type=code`) — Meta often disables token-in-URL (implicit).
 * Legacy `#access_token=...` is still handled below.
 *
 * Add this redirect under Facebook Login → Valid OAuth Redirect URIs (must match the browser URL exactly).
 */
function buildFacebookOAuthUrl(appId: string): string {
  const redirectUri = `${window.location.origin}${LOGIN_ROUTE_PATH}`;
  const state = crypto.randomUUID();
  sessionStorage.setItem("fb_oauth_state", state);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: FB_LOGIN_SCOPES,
  });

  return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = import.meta.env.VITE_META_LOGIN_APP_ID || import.meta.env.VITE_META_APP_ID || "";
  const [busy, setBusy] = useState(false);
  const [handlingReturn, setHandlingReturn] = useState(false);
  /** Increment to re-render after localStorage session changes. */
  const [, setSessionTick] = useState(0);
  /** Prevents duplicate effect runs on the same FB access_token; cleared on failure so you can try again. */
  const lastExchangedTokenRef = useRef<string | null>(null);
  /** OAuth `code` is single-use; avoid double exchange under React Strict Mode. */
  const lastExchangedCodeRef = useRef<string | null>(null);

  const finishLoginWithCode = useCallback(
    async (code: string, redirectUri: string) => {
      setBusy(true);
      try {
        await loginWithFacebookCode(code, redirectUri);
        toast.success("Signed in with Facebook");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        navigate("/", { replace: true });
      } catch (e: unknown) {
        lastExchangedCodeRef.current = null;
        const msg = e instanceof Error ? e.message : "Login failed";
        toast.error(msg);
      } finally {
        setBusy(false);
        setHandlingReturn(false);
      }
    },
    [navigate]
  );

  const finishLoginWithToken = useCallback(
    async (accessToken: string) => {
      setBusy(true);
      try {
        await loginWithFacebook(accessToken);
        toast.success("Signed in with Facebook");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        navigate("/", { replace: true });
      } catch (e: unknown) {
        lastExchangedTokenRef.current = null;
        const msg = e instanceof Error ? e.message : "Login failed";
        toast.error(msg);
      } finally {
        setBusy(false);
        setHandlingReturn(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const wantOut =
      searchParams.get("logout") === "1" ||
      searchParams.get("switch") === "1" ||
      searchParams.get("reauth") === "1";
    if (!wantOut) return;
    clearToken();
    setSessionTick((n) => n + 1);
    setSearchParams({}, { replace: true });
    toast("Signed out — you can sign in with Facebook below.");
  }, [searchParams, setSearchParams]);

  const alreadySignedIn = isAccessTokenValid(getToken());

  // OAuth return: ?code=... (default) or legacy #access_token=...
  useEffect(() => {
    const url = new URL(window.location.href);

    const qErr = url.searchParams.get("error");
    const qErrDesc = url.searchParams.get("error_description");
    if (qErr || url.searchParams.get("error_code")) {
      toast.error(qErrDesc?.replace(/\+/g, " ") || qErr || "Facebook login failed");
      window.history.replaceState(null, "", url.pathname);
      return;
    }

    const code = url.searchParams.get("code");
    const queryState = url.searchParams.get("state");
    if (code) {
      const savedState = sessionStorage.getItem("fb_oauth_state");
      if (savedState && queryState && savedState !== queryState) {
        toast.error("Login session expired. Please try again.");
        sessionStorage.removeItem("fb_oauth_state");
        window.history.replaceState(null, "", url.pathname);
        return;
      }
      if (lastExchangedCodeRef.current === code) {
        return;
      }
      lastExchangedCodeRef.current = code;
      sessionStorage.removeItem("fb_oauth_state");
      window.history.replaceState(null, "", url.pathname);
      const redirectUri = `${window.location.origin}${LOGIN_ROUTE_PATH}`;
      setHandlingReturn(true);
      void finishLoginWithCode(code, redirectUri);
      return;
    }

    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash) return;

    const params = new URLSearchParams(rawHash);
    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDesc = params.get("error_description");

    if (error || errorCode) {
      toast.error(errorDesc?.replace(/\+/g, " ") || error || "Facebook login failed");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return;
    }

    const accessToken = params.get("access_token");
    const returnedState = params.get("state");
    const savedState = sessionStorage.getItem("fb_oauth_state");

    if (!accessToken) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return;
    }

    if (lastExchangedTokenRef.current === accessToken) {
      return;
    }

    if (savedState && returnedState && savedState !== returnedState) {
      toast.error("Login session expired. Please try again.");
      sessionStorage.removeItem("fb_oauth_state");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return;
    }

    lastExchangedTokenRef.current = accessToken;
    sessionStorage.removeItem("fb_oauth_state");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setHandlingReturn(true);
    void finishLoginWithToken(accessToken);
  }, [finishLoginWithToken, finishLoginWithCode]);

  function handleFacebookLogin() {
    if (!appId) {
      toast.error("Add VITE_META_LOGIN_APP_ID to your frontend .env (Meta login app ID).");
      return;
    }

    try {
      setBusy(true);
      const url = buildFacebookOAuthUrl(appId);
      // Full navigation — Facebook’s own login UI will open.
      window.location.assign(url);
    } catch (e: unknown) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Could not start Facebook login");
    }
  }

  const loading = busy || handlingReturn;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand shadow-lg shadow-brand/30 transition-transform hover:scale-105">
            <Facebook className="h-8 w-8 text-brand-foreground" />
          </div>
          <CardTitle className="text-2xl text-foreground">Exchange Tunnel</CardTitle>
          <CardDescription>
            Sign in with Facebook to continue to your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!appId ? <p className="text-sm text-muted-foreground">Facebook login is temporarily unavailable.</p> : null}

          {alreadySignedIn && (
            <div className="space-y-3 rounded-md border border-border bg-secondary/50 p-4 text-sm">
              <p className="font-medium text-foreground">You&apos;re already signed in</p>
              <p className="text-muted-foreground">
                Open the app to continue, or sign out here if you want to use a different Facebook account.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="default" className="flex-1" onClick={() => navigate("/", { replace: true })}>
                  Go to dashboard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    clearToken();
                    setSessionTick((n) => n + 1);
                    toast("Signed out. Continue with Facebook to pick an account.");
                  }}
                >
                  Sign out &amp; use Facebook
                </Button>
              </div>
            </div>
          )}

          <Button
            type="button"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            size="lg"
            disabled={loading || !appId || alreadySignedIn}
            onClick={handleFacebookLogin}
          >
            <Facebook className="h-5 w-5" />
            {loading ? "Connecting…" : "Continue with Facebook"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link to="/privacy-policy" className="text-primary underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/data-deletion" className="text-primary underline underline-offset-2">
              Data Deletion Instructions
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
