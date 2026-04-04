/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram WebApp global
interface Window {
  Telegram?: {
    WebApp?: {
      initData: string;
      initDataUnsafe: Record<string, unknown>;
      ready: () => void;
      expand: () => void;
      close: () => void;
      MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
        setText: (text: string) => void;
      };
      BackButton: {
        isVisible: boolean;
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
      };
      themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
        secondary_bg_color?: string;
      };
      colorScheme: 'light' | 'dark';
      openInvoice: (url: string, cb?: (status: string) => void) => void;
      sendData: (data: string) => void;
      switchInlineQuery: (query: string, chatTypes?: string[]) => void;
    };
  };
}
