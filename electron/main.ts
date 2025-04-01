import { app, BrowserWindow, screen, shell } from "electron";
import path from "path";
import fs from "fs";
import { initializeIpcHandlers } from "./ipcHandlers";
import { ProcessingHelper } from "./ProcessingHelper";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { ShortcutsHelper } from "./shortcuts";
import { configHelper } from "./ConfigHelper";
import { debounce } from "lodash";

// Constants
export const isDev = process.env.NODE_ENV === "development" && !app.isPackaged;
//export const isDev = true;
// Add more detailed logging for window events
let isLoading = false;

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as ProcessingHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as any,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    SCREENSHOT_ERROR: "screenshot-error",
    NO_SCREENSHOTS: "processing-no-screenshots",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error",
  } as const,

  // Utility
  isDimensionUpdateInProgress: false,

  virtualCameraWindow: null as BrowserWindow | null,
};

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null;
  getMainWindow: () => BrowserWindow | null;
  getView: () => "queue" | "solutions" | "debug";
  setView: (view: "queue" | "solutions" | "debug") => void;
  getProblemInfo: () => any;
  setProblemInfo: (info: any) => void;
  getScreenshotQueue: () => string[];
  getExtraScreenshotQueue: () => string[];
  clearQueues: () => void;
  takeScreenshot: () => Promise<string>;
  getImagePreview: (filepath: string) => Promise<string>;
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>;
  setHasDebugged: (value: boolean) => void;
  getHasDebugged: () => boolean;
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS;
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null;
  takeScreenshot: () => Promise<string>;
  getImagePreview: (filepath: string) => Promise<string>;
  processingHelper: ProcessingHelper | null;
  clearQueues: () => void;
  setView: (view: "queue" | "solutions" | "debug") => void;
  isVisible: () => boolean;
  toggleMainWindow: () => void;
  moveWindowLeft: () => void;
  moveWindowRight: () => void;
  moveWindowUp: () => void;
  moveWindowDown: () => void;
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null;
  setWindowDimensions: (width: number, height: number) => void;
  getScreenshotQueue: () => string[];
  getExtraScreenshotQueue: () => string[];
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>;
  getImagePreview: (filepath: string) => Promise<string>;
  processingHelper: ProcessingHelper | null;
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS;
  takeScreenshot: () => Promise<string>;
  getView: () => "queue" | "solutions" | "debug";
  toggleVirtualCamera: () => { active: boolean };
  checkVirtualCamera: () => { active: boolean };
  toggleMainWindow: () => void;
  clearQueues: () => void;
  setView: (view: "queue" | "solutions" | "debug") => void;
  moveWindowLeft: () => void;
  moveWindowRight: () => void;
  moveWindowUp: () => void;
  moveWindowDown: () => void;
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view);
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS,
  } as IProcessingHelperDeps);
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step),
  } as IShortcutsHelperDeps);
}

function createVirtualCameraWindow() {
  if (state.virtualCameraWindow) {
    state.virtualCameraWindow.focus();
    return;
  }

  state.virtualCameraWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "CodeInterviewAssist Camera View",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Make it look nice for camera view
    titleBarStyle: "hidden",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    // Add useful window properties
    alwaysOnTop: false, // Not on top so it won't interfere with your work
    hasShadow: false,
    resizable: true,
  });

  // Load the same content as the main window but with a parameter to indicate camera mode
  state.virtualCameraWindow.loadURL(
    isDev
      ? "http://localhost:54321?mode=camera"
      : `file://${path.join(__dirname, "../dist/index.html?mode=camera")}`
  );

  state.virtualCameraWindow.on("closed", () => {
    state.virtualCameraWindow = null;
  });

  console.log("Virtual camera window created");
}

// Force Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore();
      state.mainWindow.focus();

      // Protocol handler removed - no longer using auth callbacks
    }
  });
}

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore();
    state.mainWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workAreaSize;
  state.screenWidth = workArea.width;
  state.screenHeight = workArea.height;
  state.step = 60;
  state.currentY = 50;

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    height: 600,
    x: state.currentX,
    y: 50,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true,
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: true,
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: false,
    resizable: false,
  };

  state.mainWindow = new BrowserWindow(windowSettings);

  state.mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window finished loading");
    isLoading = false; // Reset loading flag when finished
  });

  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      console.error("Window failed to load:", errorCode, errorDescription);

      // Only retry if in development and not already loading
      if (isDev && !isLoading) {
        isLoading = true;
        console.log("Retrying to load development server...");
        setTimeout(() => {
          if (state.mainWindow && !state.mainWindow.isDestroyed()) {
            state.mainWindow
              .loadURL("http://localhost:54321")
              .catch((error) => {
                console.error("Failed to load dev server on retry:", error);
                isLoading = false;
              });
          }
        }, 1000);
      } else {
        isLoading = false; // Reset loading flag on final failure
      }
    }
  );

  // Load the app only once
  if (!isLoading) {
    isLoading = true;
    console.log("isDev: " + isDev);
    if (isDev) {
      // In development, load from the dev server
      console.log("Loading from development server: http://localhost:54321");
      state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
        console.error(
          "Failed to load dev server, falling back to local file:",
          error
        );

        // Fallback to local file if dev server is not available
        const indexPath = path.join(__dirname, "../dist/index.html");
        console.log("Falling back to:", indexPath);

        if (fs.existsSync(indexPath)) {
          state.mainWindow.loadFile(indexPath).catch(() => {
            isLoading = false;
          });
        } else {
          console.error("Could not find index.html in dist folder");
          isLoading = false;
        }
      });
    } else {
      // In production, load from the built files
      const indexPath = path.join(__dirname, "../dist/index.html");
      console.log("Loading production build:", indexPath);

      if (fs.existsSync(indexPath)) {
        state.mainWindow.loadFile(indexPath).catch(() => {
          isLoading = false;
        });
      } else {
        console.error("Could not find index.html in dist folder");
        isLoading = false;
      }
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1);
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Attempting to open URL:", url);
    if (url.includes("google.com")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Apply native Electron API protections for
  // enhanced screen capture resistance
  state.mainWindow.setContentProtection(true);

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    state.mainWindow.setHiddenInMissionControl(true);
    state.mainWindow.setWindowButtonVisibility(false);
    state.mainWindow.setBackgroundColor("#00000000");

    // Prevent window from being included in window switcher
    state.mainWindow.setSkipTaskbar(true);

    // Disable window shadow
    state.mainWindow.setHasShadow(false);

    try {
      console.log("Applying macOS screen sharing protection measures");

      // 1. First, apply basic window properties
      state.mainWindow.setBackgroundColor("#00000000");
      state.mainWindow.setHasShadow(false);
      state.mainWindow.setSkipTaskbar(true);

      // 2. Apply the most important property for avoiding screen sharing detection
      state.mainWindow.setVisibleOnAllWorkspaces(false); // Changed from true to false

      // 3. Use the window's contentView to set layer properties (critical for screen sharing protection)
      const win = state.mainWindow as any;

      // Attempt to set NSWindow properties via Electron private APIs
      if (win.setSheetOffset) {
        // If this method exists, we likely have access to other private APIs

        // Set window collection behavior to exclude from window lists
        if (win._setCollectionBehavior) {
          // Use specific collection behavior flags that make window invisible to screen sharing
          // NSWindowCollectionBehaviorStationary (1 << 9)
          // NSWindowCollectionBehaviorIgnoresCycle (1 << 6)
          // NSWindowCollectionBehaviorTransient (1 << 7)
          win._setCollectionBehavior((1 << 9) | (1 << 6) | (1 << 7));
        }

        // Force the window to be a utility panel which is often ignored by screen sharing
        if (win._setStyleMask) {
          // NSUtilityWindowMask = 16
          win._setStyleMask(16);
        }

        // Set proper window level that's ignored by screen sharing but still visible
        // Normal screen recording captures NSScreenSaverWindowLevel (1000) and below
        // So use a higher level to avoid capture
        if (win._setWindowLevel) {
          win._setWindowLevel(2001); // Well above NSScreenSaverWindowLevel
        } else if (typeof win.setWindowLevel === "function") {
          win.setWindowLevel("floating", 5); // Max priority floating
        } else {
          // Fallback to normal API
          state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        }
      } else {
        // Standard API fallbacks if private APIs aren't available
        state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      }

      // 4. Try to set the surface to be excluded from screen capture
      //    This is the key for recent macOS versions
      state.mainWindow.setContentProtection(true);

      // 5. Use a special opacity trick that can help with screen sharing visibility
      //    Some screen sharing software doesn't capture partially transparent windows
      state.mainWindow.setOpacity(0.99); // Just barely transparent

      console.log("Successfully applied macOS screen sharing protection");
    } catch (err) {
      console.warn(
        "Error applying advanced macOS screen sharing protection:",
        err
      );

      // Fallback to basic protection
      state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      state.mainWindow.setHiddenInMissionControl(true);
      state.mainWindow.setSkipTaskbar(true);
    }
  }

  // Prevent the window from being captured by screen recording
  state.mainWindow.webContents.setBackgroundThrottling(false);
  state.mainWindow.webContents.setFrameRate(60);

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove);
  state.mainWindow.on("resize", handleWindowResize);
  state.mainWindow.on("closed", handleWindowClosed);

  // Initialize window state
  const bounds = state.mainWindow.getBounds();
  state.windowPosition = { x: bounds.x, y: bounds.y };
  state.windowSize = { width: bounds.width, height: bounds.height };
  state.currentX = bounds.x;
  state.currentY = bounds.y;
  state.isWindowVisible = true;

  // Set opacity based on user preferences or hide initially
  // Ensure the window is visible for the first launch or if opacity > 0.1
  const savedOpacity = configHelper.getOpacity();
  console.log(`Initial opacity from config: ${savedOpacity}`);

  // Always make sure window is shown first
  state.mainWindow.showInactive(); // Use showInactive for consistency

  if (savedOpacity <= 0.1) {
    console.log("Initial opacity too low, setting to 0 and hiding window");
    state.mainWindow.setOpacity(0);
    state.isWindowVisible = false;
  } else {
    console.log(`Setting initial opacity to ${savedOpacity}`);
    state.mainWindow.setOpacity(savedOpacity);
    state.isWindowVisible = true;
  }
  devTools(); // Open DevTools if in development mode
}

export function devTools(): void {
  // Check if the main window is not destroyed
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    console.log("Main window is null or destroyed, skipping DevTools");
    return;
  }

  // Get current DevTools state
  const isDevToolsOpen = state.mainWindow.webContents.isDevToolsOpened();

  // If DevTools not open, open it. If DevTools open, close it.
  if (isDev && !isDevToolsOpen) {
    // Open DevTools in a detached window
    state.mainWindow.webContents.openDevTools({ mode: "detach" });

    // Resize window to accommodate DevTools and set it to a good position
    const currentDisplay = screen.getDisplayNearestPoint({
      x: state.mainWindow.getBounds().x,
      y: state.mainWindow.getBounds().y,
    });

    // Calculate a good size and position for development
    const devWidth = Math.min(1000, currentDisplay.workAreaSize.width * 0.6);
    const devHeight = Math.min(800, currentDisplay.workAreaSize.height * 0.8);
    const devX =
      currentDisplay.workArea.x +
      (currentDisplay.workArea.width - devWidth) / 2;
    const devY =
      currentDisplay.workArea.y +
      (currentDisplay.workArea.height - devHeight) / 2;

    // Apply new dimensions
    state.mainWindow.setBounds({
      x: Math.round(devX),
      y: Math.round(devY),
      width: Math.round(devWidth),
      height: Math.round(devHeight),
    });

    // Update state to reflect new position and size
    state.windowPosition = { x: Math.round(devX), y: Math.round(devY) };
    state.windowSize = {
      width: Math.round(devWidth),
      height: Math.round(devHeight),
    };
    state.currentX = Math.round(devX);
    state.currentY = Math.round(devY);

    console.log("DevTools opened");
  } else if (isDevToolsOpen) {
    // Close DevTools if they're open
    state.mainWindow.webContents.closeDevTools();
    console.log("DevTools closed");
  }
}

function handleWindowMove(): void {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.windowPosition = { x: bounds.x, y: bounds.y };
  state.currentX = bounds.x;
  state.currentY = bounds.y;
}

function handleWindowResize(): void {
  if (!state.mainWindow) return;
  const bounds = state.mainWindow.getBounds();
  state.windowSize = { width: bounds.width, height: bounds.height };
}

function handleWindowClosed(): void {
  state.mainWindow = null;
  state.isWindowVisible = false;
  state.windowPosition = null;
  state.windowSize = null;
}

// Window visibility functions
function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };

    // Set ignore mouse events first, before hiding
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Update window settings
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });

    // Fade out then hide
    state.mainWindow.setOpacity(0);
    setTimeout(() => {
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.hide();
      }
    }, 50);

    state.isWindowVisible = false;
  }
}

function showMainWindow(): void {
  // If window is null or destroyed, try to create a new one
  if (!state.mainWindow || state.mainWindow.isDestroyed()) {
    console.log("Window is null or destroyed, creating new window");
    createWindow().catch((err) => {
      console.error("Failed to create new window:", err);
    });
    return;
  }

  try {
    // Important: keep mouse events ignored initially, but don't override renderer process settings
    // Let the renderer process handle clickable elements

    // Position and show the window
    if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize,
      });
    }

    // Set window properties
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    state.mainWindow.setContentProtection(true);

    // Show with initial zero opacity
    state.mainWindow.setOpacity(0);
    state.mainWindow.showInactive();

    // Gradually increase opacity
    let opacity = 0;
    const fadeInterval = setInterval(() => {
      opacity += 0.2;
      if (opacity >= 1) {
        clearInterval(fadeInterval);
        opacity = 1;

        // Signal to the renderer that the window is fully shown
        if (state.mainWindow && !state.mainWindow.isDestroyed()) {
          state.mainWindow.webContents.send("window-fully-shown");
        }
      }

      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.setOpacity(opacity);
      } else {
        clearInterval(fadeInterval);
      }
    }, 20);

    state.isWindowVisible = true;
  } catch (error) {
    console.error("Error showing window:", error);
    // If we encounter an error, try to create a new window
    createWindow().catch((err) => {
      console.error("Failed to create new window after error:", err);
    });
  }
}

function toggleMainWindow(): void {
  if (state.isWindowVisible) {
    hideMainWindow();
  } else {
    showMainWindow();
  }
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return;
  state.currentX = updateFn(state.currentX);
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  );
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return;

  const newY = updateFn(state.currentY);
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3;
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3;

  // Log the current state and limits
  /*console.log({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY,
  });*/

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY;
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    );
  }
}

// Virtual Camera
const toggleVirtualCamera = (): { active: boolean } => {
  if (state.virtualCameraWindow) {
    state.virtualCameraWindow.close();
    state.virtualCameraWindow = null;
    return { active: false };
  } else {
    createVirtualCameraWindow();
    return { active: true };
  }
};

const checkVirtualCamera = (): { active: boolean } => {
  return { active: state.virtualCameraWindow !== null };
};

// Window dimension functions
const setWindowDimensionsInternal = (width: number, height: number): void => {
  if (!state.mainWindow?.isDestroyed()) {
    // Seeing as it works when dev-mode is open, then just return without executing anything
    return;

    // Prevent dimension update if a dialog is open
    if (state.mainWindow.webContents.isDevToolsOpened()) {
      console.log("Skipping dimension update while DevTools is open");
      return;
    }

    const [currentX, currentY] = state.mainWindow.getPosition();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workAreaSize;
    const maxWidth = Math.floor(workArea.width * 0.5);

    // Store the new dimensions in state
    state.windowSize = {
      width: Math.min(width + 32, maxWidth),
      height: Math.ceil(height),
    };

    state.mainWindow.setBounds({
      x: Math.min(currentX, workArea.width - maxWidth),
      y: currentY,
      width: state.windowSize.width,
      height: state.windowSize.height,
    });

    console.log(
      `Window dimensions set to: ${state.windowSize.width}x${state.windowSize.height}`
    );
  }
};

// Use a smaller debounce delay for smoother resizing
const setWindowDimensions = debounce(setWindowDimensionsInternal, 100); // Reduced from 300ms to 100ms

// Initialize application
async function initializeApp() {
  try {
    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(
      app.getPath("appData"),
      "codeinterviewassist-v1"
    );
    const sessionPath = path.join(appDataPath, "session");
    const tempPath = path.join(appDataPath, "temp");
    const cachePath = path.join(appDataPath, "cache");

    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    app.setPath("userData", appDataPath);
    app.setPath("sessionData", sessionPath);
    app.setPath("temp", tempPath);
    app.setPath("cache", cachePath);

    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      console.log(
        "No API key found in configuration. User will need to set up."
      );
    }

    initializeHelpers();
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step),
      toggleVirtualCamera: () => toggleVirtualCamera(),
      checkVirtualCamera: () => checkVirtualCamera(),
    });
    await createWindow();
    state.shortcutsHelper?.registerGlobalShortcuts();
  } catch (error) {
    console.error("Failed to initialize application:", error);
    app.quit();
  }
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  console.log("open-url event received:", url);
  event.preventDefault();
});

// Handle second instance (removed auth callback handling)
app.on("second-instance", (event, commandLine) => {
  console.log("second-instance event received:", commandLine);

  // Focus or create the main window
  if (!state.mainWindow) {
    createWindow();
  } else {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore();
    state.mainWindow.focus();
  }
});

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
      state.mainWindow = null;
    }
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow;
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view;
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view;
  state.screenshotHelper?.setView(view);
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper;
}

function getProblemInfo(): any {
  return state.problemInfo;
}

function setProblemInfo(problemInfo: any): void {
  state.problemInfo = problemInfo;
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || [];
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || [];
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues();
  state.problemInfo = null;
  setView("queue");
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available");
  return (
    state.screenshotHelper?.takeScreenshot(
      () => hideMainWindow(),
      () => showMainWindow()
    ) || ""
  );
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || "";
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized",
    }
  );
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value;
}

function getHasDebugged(): boolean {
  return state.hasDebugged;
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged,
};

app.whenReady().then(initializeApp);
