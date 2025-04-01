import SubscribedApp from "./_pages/SubscribedApp";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./components/ui/toast";
import { ToastContext } from "./contexts/toast";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SettingsDialog } from "./components/Settings/SettingsDialog";

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Root component that provides the QueryClient
function App() {
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as "neutral" | "success" | "error",
  });
  const [currentLanguage, setCurrentLanguage] = useState<string>("python");
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  // Note: Model selection is now handled via separate extraction/solution/debugging model settings

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Set the window to be click-through by default
    window.electronAPI.setIgnoreMouseEvents(true, { forward: true });

    // Create a single pointer-events handler using event delegation
    const handlePointerEvents = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      let foundClickable = false;

      // Traverse up to find if we're on a clickable element
      while (target && target !== document.body) {
        if (target.classList.contains("clickable")) {
          foundClickable = true;
          break;
        }
        target = target.parentElement as HTMLElement;
      }

      // Toggle mouse event handling based on whether we're over a clickable element
      if (foundClickable && e.type === "mouseover") {
        window.electronAPI.setIgnoreMouseEvents(false);
      } else if (!foundClickable && e.type === "mouseout") {
        // Check if the element we're moving to is also not clickable
        let relatedTarget = e.relatedTarget as HTMLElement;
        let movingToClickable = false;

        while (relatedTarget && relatedTarget !== document.body) {
          if (relatedTarget.classList.contains("clickable")) {
            movingToClickable = true;
            break;
          }
          relatedTarget = relatedTarget.parentElement as HTMLElement;
        }

        if (!movingToClickable) {
          window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    };

    // Add event listeners
    document.addEventListener("mouseover", handlePointerEvents);
    document.addEventListener("mouseout", handlePointerEvents);

    // Clean up
    return () => {
      document.removeEventListener("mouseover", handlePointerEvents);
      document.removeEventListener("mouseout", handlePointerEvents);
      window.electronAPI.setIgnoreMouseEvents(false);
    };
  }, []);

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage);
    window.__LANGUAGE__ = newLanguage;
  }, []);

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setIsInitialized(true);
    window.__IS_INITIALIZED__ = true;
  }, []);

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant,
      });
    },
    []
  );

  // Check for API key and prompt if not found
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const hasKey = await window.electronAPI.checkApiKey();
        setHasApiKey(hasKey);

        // If no API key is found, show the settings dialog after a short delay
        if (!hasKey) {
          setTimeout(() => {
            setIsSettingsOpen(true);
          }, 1000);
        }
      } catch (error) {
        console.error("Failed to check API key:", error);
      }
    };

    if (isInitialized) {
      checkApiKey();
    }
  }, [isInitialized]);

  // Initialize dropdown handler
  useEffect(() => {
    if (isInitialized) {
      // Process all types of dropdown elements with a shorter delay
      const timer = setTimeout(() => {
        // Find both native select elements and custom dropdowns
        const selectElements = document.querySelectorAll("select");
        const customDropdowns = document.querySelectorAll(
          '.dropdown-trigger, [role="combobox"], button:has(.dropdown)'
        );

        // Enable native selects
        selectElements.forEach((dropdown) => {
          dropdown.disabled = false;
        });

        // Enable custom dropdowns by removing any disabled attributes
        customDropdowns.forEach((dropdown) => {
          if (dropdown instanceof HTMLElement) {
            dropdown.removeAttribute("disabled");
            dropdown.setAttribute("aria-disabled", "false");
          }
        });

        console.log(
          `Enabled ${selectElements.length} select elements and ${customDropdowns.length} custom dropdowns`
        );
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  // Listen for settings dialog open requests
  useEffect(() => {
    const unsubscribeSettings = window.electronAPI.onShowSettings(() => {
      console.log("Show settings dialog requested");
      setIsSettingsOpen(true);
    });

    return () => {
      unsubscribeSettings();
    };
  }, []);

  // Initialize basic app state
  useEffect(() => {
    // Load config and set values
    const initializeApp = async () => {
      try {
        // Load config including language and model settings
        const config = await window.electronAPI.getConfig();

        // Load language preference
        if (config && config.language) {
          updateLanguage(config.language);
        } else {
          updateLanguage("python");
        }

        // Model settings are now managed through the settings dialog
        // and stored in config as extractionModel, solutionModel, and debuggingModel

        markInitialized();
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Fallback to defaults
        updateLanguage("python");
        markInitialized();
      }
    };

    initializeApp();

    // Event listeners for process events
    const onApiKeyInvalid = () => {
      showToast(
        "API Key Invalid",
        "Your API key appears to be invalid or has insufficient credits",
        "error"
      );
    };

    // Store the cleanup function
    const cleanupApiKeyListener =
      window.electronAPI.onApiKeyInvalid(onApiKeyInvalid);

    // Cleanup function
    return () => {
      // Call the cleanup function directly instead of manually removing
      cleanupApiKeyListener();
      window.__IS_INITIALIZED__ = false;
      setIsInitialized(false);
    };
  }, [updateLanguage, markInitialized, showToast]);

  // API Key dialog management
  const handleOpenSettings = useCallback(() => {
    console.log("Opening settings dialog");
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback((open: boolean) => {
    console.log("Settings dialog state changed:", open);
    setIsSettingsOpen(open);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <div className="relative">
            {isInitialized ? (
              hasApiKey ? (
                <SubscribedApp
                  currentLanguage={currentLanguage}
                  setLanguage={updateLanguage}
                />
              ) : (
                <WelcomeScreen onOpenSettings={handleOpenSettings} />
              )
            ) : (
              <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                  <p className="text-white/60 text-sm">Initializing...</p>
                </div>
              </div>
            )}
          </div>

          {/* Settings Dialog */}
          <SettingsDialog
            open={isSettingsOpen}
            onOpenChange={handleCloseSettings}
          />

          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
