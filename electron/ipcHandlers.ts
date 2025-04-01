// ipcHandlers.ts

import { dialog, ipcMain, shell } from "electron";
import { IIpcHandlerDeps } from "./main";
import { configHelper } from "./ConfigHelper";

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("Initializing IPC handlers");

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  });

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  });

  // Platform handler
  ipcMain.handle("get-platform", () => {
    console.log("get-platform handler called, returning:", process.platform);
    return process.platform;
  });

  // Screenshot permission handler
  ipcMain.handle("check-screenshot-permissions", async () => {
    try {
      if (process.platform === "win32") {
        console.log("Checking Windows screenshot permissions");

        // Import screenshot-desktop only in main process
        const screenshot = require("screenshot-desktop");

        // Use a timeout to prevent hanging forever
        return new Promise((resolve) => {
          // Set a timeout to avoid hanging forever
          const timeoutId = setTimeout(() => {
            console.log("Screenshot permission check timed out");
            resolve({
              success: false,
              error: "Permission check timed out",
            });
          }, 5000); // 5 second timeout

          try {
            screenshot({ format: "png" }, (error: any, img: any) => {
              // Clear timeout since we got a response
              clearTimeout(timeoutId);

              if (error) {
                console.error("Windows screenshot permission issue:", error);

                // Show dialog from main process
                dialog.showMessageBox({
                  type: "warning",
                  title: "Screenshot Permission",
                  message:
                    "InterviewCoder needs permission to capture screenshots.",
                  detail:
                    "Please ensure that screen recording permissions are enabled for this application.",
                  buttons: ["OK"],
                });

                resolve({ success: false, error: error.toString() });
              } else {
                console.log("Windows screenshot permissions are granted");
                resolve({ success: true });
              }
            });
          } catch (innerError) {
            // Clear timeout
            clearTimeout(timeoutId);
            console.error("Error in screenshot test:", innerError);
            resolve({
              success: false,
              error: innerError.toString(),
            });
          }
        });
      }

      // For non-Windows platforms, assume success
      return { success: true };
    } catch (error: any) {
      console.error("Error checking screenshot permissions:", error);
      return {
        success: false,
        error: error?.toString() || "Unknown error checking permissions",
      };
    }
  });

  // Screen sharing protection toggle
  ipcMain.handle(
    "toggle-screen-sharing-protection",
    (_event, enabled: boolean) => {
      const win = deps.getMainWindow();
      if (!win || win.isDestroyed()) return { success: false };

      if (process.platform === "darwin") {
        try {
          console.log(
            `${enabled ? "Enabling" : "Disabling"} screen sharing protection`
          );

          // The most important properties for screen sharing protection:

          // 1. Content protection is the main defense
          win.setContentProtection(enabled);

          // 2. Visible on all workspaces affects screen sharing visibility
          // When false, it's harder to detect in screen sharing
          win.setVisibleOnAllWorkspaces(!enabled);

          // 3. Try private APIs if available
          const browserWin = win as any;

          if (browserWin._setCollectionBehavior) {
            if (enabled) {
              // Use behavior flags that hide from screen sharing
              browserWin._setCollectionBehavior((1 << 9) | (1 << 6) | (1 << 7));
            } else {
              // Use normal behavior flags
              browserWin._setCollectionBehavior(0);
            }
          }

          if (browserWin._setWindowLevel) {
            if (enabled) {
              // Use a level that's ignored by screen sharing
              browserWin._setWindowLevel(2001);
            } else {
              // Use normal level
              browserWin._setWindowLevel(0);
            }
          }

          // 4. Set opacity to just under 1.0 which can help with some screen sharing software
          if (enabled) {
            win.setOpacity(0.99);
          }

          return { success: true };
        } catch (err) {
          console.warn("Error toggling screen sharing protection:", err);
          return { success: false, error: err.toString() };
        }
      }

      return { success: true };
    }
  );

  // Virtual Camera toggle
  ipcMain.handle("toggle-virtual-camera", () => {
    // Call the method from deps instead of directly accessing the window
    return deps.toggleVirtualCamera();
  });
  
  // Also add this handler
  ipcMain.handle("check-virtual-camera", () => {
    // Call the method from deps
    return deps.checkVirtualCamera();
  });

  // Provider handlers
  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  });

  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return {
        valid: false,
        error: "Invalid API key format.",
      };
    }

    // Then test the API key
    const result = await configHelper.testApiKey(apiKey);
    return result;
  });

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue();
  });

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue();
  });

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path);
  });

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path);
  });

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }

    await deps.processingHelper?.processScreenshots();
  });

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height);
      }
    }
  );

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height);
    }
  );

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = [];
      const currentView = deps.getView();

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue();
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path),
          }))
        );
      } else {
        const extraQueue = deps.getExtraScreenshotQueue();
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path),
          }))
        );
      }

      return previews;
    } catch (error) {
      console.error("Error getting screenshots:", error);
      throw error;
    }
  });

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot();
        const preview = await deps.getImagePreview(screenshotPath);
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview,
        });
        return { success: true };
      } catch (error) {
        console.error("Error triggering screenshot:", error);
        return { error: "Failed to trigger screenshot" };
      }
    }
    return { error: "No main window available" };
  });

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot();
      const preview = await deps.getImagePreview(screenshotPath);
      return { path: screenshotPath, preview };
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return { error: "Failed to take screenshot" };
    }
  });

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url);
  });

  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  });

  // Settings portal handler
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  });

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow();
      return { success: true };
    } catch (error) {
      console.error("Error toggling window:", error);
      return { error: "Failed to toggle window" };
    }
  });

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues();
      return { success: true };
    } catch (error) {
      console.error("Error resetting queues:", error);
      return { error: "Failed to reset queues" };
    }
  });

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }

      await deps.processingHelper?.processScreenshots();
      return { success: true };
    } catch (error) {
      console.error("Error processing screenshots:", error);
      return { error: "Failed to process screenshots" };
    }
  });

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests();

      // Clear all queues immediately
      deps.clearQueues();

      // Reset view to queue
      deps.setView("queue");

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view");
        mainWindow.webContents.send("reset");
      }

      return { success: true };
    } catch (error) {
      console.error("Error triggering reset:", error);
      return { error: "Failed to trigger reset" };
    }
  });

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft();
      return { success: true };
    } catch (error) {
      console.error("Error moving window left:", error);
      return { error: "Failed to move window left" };
    }
  });

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight();
      return { success: true };
    } catch (error) {
      console.error("Error moving window right:", error);
      return { error: "Failed to move window right" };
    }
  });

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp();
      return { success: true };
    } catch (error) {
      console.error("Error moving window up:", error);
      return { error: "Failed to move window up" };
    }
  });

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown();
      return { success: true };
    } catch (error) {
      console.error("Error moving window down:", error);
      return { error: "Failed to move window down" };
    }
  });

  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue =
        deps.getView() === "queue"
          ? deps.getScreenshotQueue()
          : deps.getExtraScreenshotQueue();

      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" };
      }

      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1];

      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot);

      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", {
          path: lastScreenshot,
        });
      }

      return result;
    } catch (error) {
      console.error("Error deleting last screenshot:", error);
      return { success: false, error: "Failed to delete last screenshot" };
    }
  });

  // Add click-through handler
  ipcMain.handle(
    "set-ignore-mouse-events",
    (_event, ignore: boolean, options?: { forward: boolean }) => {
      const win = deps.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, options);
      }
    }
  );
}
