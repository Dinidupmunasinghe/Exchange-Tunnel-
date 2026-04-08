/** Minimal types for the Facebook JS SDK loaded from connect.facebook.net */
export {};

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options?: { scope?: string; return_scopes?: boolean; auth_type?: string }
      ) => void;
      getLoginStatus: (callback: (response: FacebookLoginResponse) => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FacebookLoginResponse {
  status: string;
  authResponse?: {
    accessToken: string;
    userID: string;
    expiresIn: string;
    signedRequest: string;
    graphDomain: string;
    data_access_expiration_time: string;
  };
}
