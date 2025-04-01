console.log("Preload script starting...");
import { contextBridge, ipcRenderer, shell } from "electron";

// Types for the exposed Electron API
interface ElectronAPI {
  // System and window operations
  openLink: (url: string) => Promise<void>;
  updateContentDimensions: (dimensions: {
    width: number;
    height: number;
  }) => Promise<void>;
  toggleMainWindow: () => Promise<void>;
  openSettingsPortal: () => Promise<void>;
  getPlatform: () => Promise<string>;

  // Screenshot operations
  getScreenshots: () => Promise<{
    success: boolean;
    previews?: Array<{ path: string; preview: string }> | null;
    error?: string;
  }>;
  deleteScreenshot: (path: string) => Promise<void>;
  triggerScreenshot: () => Promise<void>;
  triggerProcessScreenshots: () => Promise<void>;
  deleteLastScreenshot: () => Promise<void>;

  // Navigation controls
  triggerReset: () => Promise<void>;
  triggerMoveLeft: () => Promise<void>;
  triggerMoveRight: () => Promise<void>;
  triggerMoveUp: () => Promise<void>;
  triggerMoveDown: () => Promise<void>;

  // Configuration
  getConfig: () => Promise<any>;
  updateConfig: (config: any) => Promise<void>;
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (apiKey: string) => Promise<boolean>;

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void;
  onScreenshotError: (callback: (error: string) => void) => () => void;
  onResetView: (callback: () => void) => () => void;
  onShowSettings: (callback: () => void) => () => void;
  onDeleteLastScreenshot: (callback: () => void) => () => void;

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
  setIgnoreMouseEvents: (
    ignore: boolean,
    options?: { forward: boolean }
  ) => Promise<void>;
}

export const PROCESSING_EVENTS = {
  // Global states
  NO_SCREENSHOTS: "processing-no-screenshots",
  API_KEY_INVALID: "api-key-invalid",
  SCREENSHOT_ERROR: "screenshot-error",

  // States for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  RESET: "reset",

  // States for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error",
} as const;

console.log("Preload script is running");

const electronAPI: ElectronAPI = {
  // System and window operations
  openLink: (url: string) => shell.openExternal(url),
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  toggleMainWindow: async () => {
    console.log("toggleMainWindow called from preload");
    try {
      const result = await ipcRenderer.invoke("toggle-window");
      console.log("toggle-window result:", result);
      return result;
    } catch (error) {
      console.error("Error in toggleMainWindow:", error);
      throw error;
    }
  },
  openSettingsPortal: () => ipcRenderer.invoke("open-settings-portal"),
  getPlatform: async () => {
    try {
      //console.log("Calling get-platform from preload");
      const platform =
        (await ipcRenderer.invoke("get-platform")) || process.platform;
      //console.log("Platform returned:", platform);
      return platform;
    } catch (error) {
      console.error("Error getting platform:", error);
      return process.platform;
    }
  },

  // Screenshot operations
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  triggerProcessScreenshots: () =>
    ipcRenderer.invoke("trigger-process-screenshots"),
  deleteLastScreenshot: () => ipcRenderer.invoke("delete-last-screenshot"),

  // Navigation controls
  triggerReset: () => ipcRenderer.invoke("trigger-reset"),
  triggerMoveLeft: () => ipcRenderer.invoke("trigger-move-left"),
  triggerMoveRight: () => ipcRenderer.invoke("trigger-move-right"),
  triggerMoveUp: () => ipcRenderer.invoke("trigger-move-up"),
  triggerMoveDown: () => ipcRenderer.invoke("trigger-move-down"),

  // Configuration
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: any) => ipcRenderer.invoke("update-config", config),
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke("validate-api-key", apiKey),

  // Event listeners - Screenshot operations
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data);
    ipcRenderer.on("screenshot-taken", subscription);
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription);
    };
  },
  onScreenshotError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on(PROCESSING_EVENTS.SCREENSHOT_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SCREENSHOT_ERROR,
        subscription
      );
    };
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("reset-view", subscription);
    return () => {
      ipcRenderer.removeListener("reset-view", subscription);
    };
  },
  onShowSettings: (callback: () => void) => {
    console.log("Registering onShowSettings listener");
    const subscription = () => {
      console.log("show-settings-dialog event received");
      callback();
    };
    ipcRenderer.on("show-settings-dialog", subscription);
    return () => {
      console.log("Removing onShowSettings listener");
      ipcRenderer.removeListener("show-settings-dialog", subscription);
    };
  },
  onDeleteLastScreenshot: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("delete-last-screenshot", subscription);
    return () => {
      ipcRenderer.removeListener("delete-last-screenshot", subscription);
    };
  },

  // Event listeners - Solution processing
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription);
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription);
    };
  },
  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      );
    };
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      );
    };
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      );
    };
  },

  // Event listeners - Debug processing
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription);
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription);
    };
  },
  onDebugSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on("debug-success", subscription);
    return () => {
      ipcRenderer.removeListener("debug-success", subscription);
    };
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription);
    };
  },

  // Event listeners - Status messages
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.NO_SCREENSHOTS,
        subscription
      );
    };
  },
  onApiKeyInvalid: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.API_KEY_INVALID, subscription);
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.API_KEY_INVALID,
        subscription
      );
    };
  },
  onReset: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on(PROCESSING_EVENTS.RESET, subscription);
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.RESET, subscription);
    };
  },
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.invoke("set-ignore-mouse-events", ignore, options),
};

// Expose only specific API functions
contextBridge.exposeInMainWorld("electronAPI", {
  // Only expose the onShowSettings function
  onShowSettings: electronAPI.onShowSettings,

  // You need to add any other functions your app is currently using:
  openLink: electronAPI.openLink,
  openSettingsPortal: electronAPI.openSettingsPortal,
  updateContentDimensions: electronAPI.updateContentDimensions,
  toggleMainWindow: electronAPI.toggleMainWindow,
  getPlatform: electronAPI.getPlatform,
  getScreenshots: electronAPI.getScreenshots,
  deleteScreenshot: electronAPI.deleteScreenshot,
  triggerScreenshot: electronAPI.triggerScreenshot,
  triggerProcessScreenshots: electronAPI.triggerProcessScreenshots,
  deleteLastScreenshot: electronAPI.deleteLastScreenshot,
  triggerReset: electronAPI.triggerReset,
  triggerMoveLeft: electronAPI.triggerMoveLeft,
  triggerMoveRight: electronAPI.triggerMoveRight,
  triggerMoveUp: electronAPI.triggerMoveUp,
  triggerMoveDown: electronAPI.triggerMoveDown,
  getConfig: electronAPI.getConfig,
  updateConfig: electronAPI.updateConfig,
  checkApiKey: electronAPI.checkApiKey,
  validateApiKey: electronAPI.validateApiKey,
  onScreenshotTaken: electronAPI.onScreenshotTaken,
  onScreenshotError: electronAPI.onScreenshotError,
  onResetView: electronAPI.onResetView,
  onDeleteLastScreenshot: electronAPI.onDeleteLastScreenshot,
  onSolutionStart: electronAPI.onSolutionStart,
  onProblemExtracted: electronAPI.onProblemExtracted,
  onSolutionSuccess: electronAPI.onSolutionSuccess,
  onSolutionError: electronAPI.onSolutionError,
  onDebugStart: electronAPI.onDebugStart,
  onDebugSuccess: electronAPI.onDebugSuccess,
  onDebugError: electronAPI.onDebugError,
  onProcessingNoScreenshots: electronAPI.onProcessingNoScreenshots,
  onApiKeyInvalid: electronAPI.onApiKeyInvalid,
  onReset: electronAPI.onReset,
  setIgnoreMouseEvents: electronAPI.setIgnoreMouseEvents,
});

// Keep the existing electron ipcRenderer exposure
contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, (event, ...args) => func(...args));
    },
  },
});

// Add focus restoration handler
ipcRenderer.on("restore-focus", () => {
  const activeElement = document.activeElement as HTMLElement;
  if (activeElement && typeof activeElement.focus === "function") {
    activeElement.focus();
  }
});

console.log("electronAPI exposed to window");
