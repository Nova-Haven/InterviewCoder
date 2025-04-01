// Initialize default platform values
let cachedPlatform: string | null = null;
let isWindowsValue = false;
let isMacOSValue = false;
let commandKeyValue = "Ctrl";

// Get the platform safely
const getPlatform = async (): Promise<string> => {
  try {
    return window.electronAPI?.getPlatform() || "win32"; // Default to win32 if API is not available
  } catch {
    return "win32"; // Default to win32 if there's an error
  }
};

// Initialize platform values asynchronously
export const initPlatform = async (): Promise<void> => {
  try {
    // Only fetch platform if not already cached
    if (cachedPlatform === null) {
      cachedPlatform = await getPlatform();
      isWindowsValue = cachedPlatform === "win32";
      isMacOSValue = cachedPlatform === "darwin";
      commandKeyValue = isMacOSValue ? "⌘" : "Ctrl";
      console.log(`Platform initialized: ${cachedPlatform}`);
    }
  } catch (error) {
    console.error("Failed to initialize platform:", error);
    // Fallback to defaults if initialization fails
    cachedPlatform = "win32";
    isWindowsValue = true;
    isMacOSValue = false;
    commandKeyValue = "Ctrl";
  }
};

// Call initialization immediately to start the process
initPlatform();

// Export platform-specific values as functions to get the current value
export const getPlatformSync = (): string => cachedPlatform || "win32";
export const isWindows = (): boolean => isWindowsValue;
export const isMacOS = (): boolean => isMacOSValue;
export const commandKey = (): string => commandKeyValue; // Export as a function

// React hook for components - only use this inside components!
import { useState, useEffect } from "react";

export const usePlatform = () => {
  const [platform, setPlatform] = useState<string>(cachedPlatform || "win32");
  const [commandKeyState, setCommandKeyState] = useState<string>(commandKeyValue);

  useEffect(() => {
    let mounted = true;

    const loadPlatform = async () => {
      if (!cachedPlatform) {
        await initPlatform();
      }

      if (mounted) {
        setPlatform(cachedPlatform || "win32");
        setCommandKeyState(commandKeyValue);
      }
    };

    loadPlatform();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    platform,
    isWindows: platform === "win32",
    isMacOS: platform === "darwin",
    commandKey: commandKeyState,
  };
};