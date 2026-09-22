interface GoogleCredentialResponse {
  readonly credential: string;
  readonly select_by?: string;
}

interface GoogleAccountsIdApi {
  initialize(options: {
    readonly client_id: string;
    readonly callback: (response: GoogleCredentialResponse) => void;
    readonly auto_select?: boolean;
    readonly cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      readonly type?: "standard" | "icon";
      readonly theme?: "outline" | "filled_blue" | "filled_black";
      readonly size?: "large" | "medium" | "small";
      readonly text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      readonly shape?: "rectangular" | "pill" | "circle" | "square";
      readonly logo_alignment?: "left" | "center";
      readonly width?: number;
      readonly locale?: string;
    },
  ): void;
  disableAutoSelect(): void;
}

interface GoogleTokenResponse {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(overrides?: { readonly prompt?: string }): void;
}

interface GoogleAccountsOauth2Api {
  initTokenClient(options: {
    readonly client_id: string;
    readonly scope: string;
    readonly callback: (response: GoogleTokenResponse) => void;
    readonly error_callback?: (error: { readonly type?: string }) => void;
  }): GoogleTokenClient;
}

interface Window {
  google?: {
    readonly accounts: {
      readonly id: GoogleAccountsIdApi;
      readonly oauth2: GoogleAccountsOauth2Api;
    };
  };
}
