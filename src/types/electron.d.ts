export interface ElectronAPI {
  // System and window operations
  openLink: (url: string) => Promise<void>;
  toggleVirtualCamera: () => Promise<{ active: boolean }>;
  checkVirtualCamera: () => Promise<{ active: boolean }>;
  checkScreenshotPermissions: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  updateContentDimensions: (dimensions: {
    width: number;
    height: number;
  }) => Promise<void>;
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>;
  openSettingsPortal: () => Promise<void>;
  getPlatform: () => Promise<string>;
  setIgnoreMouseEvents: (
    ignore: boolean,
    options?: { forward: boolean }
  ) => Promise<void>;
  toggleScreenSharingProtection: (enabled: boolean) => Promise<{
    success: boolean;
    error?: string;
    fallback?: boolean;
  }>;

  // Screenshot operations
  getScreenshots: () => Promise<{
    success: boolean;
    previews?: Array<{ path: string; preview: string }> | null;
    error?: string;
  }>;
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>;
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>;
  triggerProcessScreenshots: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  deleteLastScreenshot: () => Promise<void>;

  // Navigation controls
  triggerReset: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>;
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>;

  // Configuration
  getConfig: () => Promise<{ apiKey: string; model: string }>;
  updateConfig: (config: {
    apiKey?: string;
    model?: string;
  }) => Promise<boolean>;
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (
    apiKey: string
  ) => Promise<{ valid: boolean; error?: string }>;

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void;
  onScreenshotError: (callback: (error: string) => void) => () => void;
  onResetView: (callback: () => void) => () => void;
  onShowSettings: (callback: () => void) => () => void;
  onDeleteLastScreenshot: (callback: () => void) => () => void;
  onWindowFullyShown: (callback: () => void) => () => void;

  // Processing event listeners
  onSolutionStart: (callback: () => void) => () => void;
  onProblemExtracted: (callback: (data: any) => void) => () => void;
  onSolutionSuccess: (callback: (data: any) => void) => () => void;
  onSolutionError: (callback: (error: string) => void) => () => void;
  onDebugStart: (callback: () => void) => () => void;
  onDebugSuccess: (callback: (data: any) => void) => () => void;
  onDebugError: (callback: (error: string) => void) => () => void;
  onProcessingNoScreenshots: (callback: () => void) => () => void;
  onApiKeyInvalid: (callback: () => void) => () => void;
  onReset: (callback: () => void) => () => void;

  // Utility
  removeListener: (
    eventName: string,
    callback: (...args: any[]) => void
  ) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
      };
    };
    __LANGUAGE__: string;
    __IS_INITIALIZED__: boolean;
    __AUTH_TOKEN__?: string | null;
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
      };
    };
    __LANGUAGE__: string;
    __IS_INITIALIZED__: boolean;
    __AUTH_TOKEN__?: string | null;
  }
}
