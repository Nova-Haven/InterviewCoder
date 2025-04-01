// file: src/components/SubscribedApp.tsx
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Queue from "../_pages/Queue";
import Solutions from "../_pages/Solutions";
import { useToast } from "../contexts/toast";

interface SubscribedAppProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

const SubscribedApp: React.FC<SubscribedAppProps> = ({
  currentLanguage,
  setLanguage,
}) => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue");
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Let's ensure we reset queries etc. if some electron signals happen
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({
        queryKey: ["screenshots"],
      });
      queryClient.invalidateQueries({
        queryKey: ["problem_statement"],
      });
      queryClient.invalidateQueries({
        queryKey: ["solution"],
      });
      queryClient.invalidateQueries({
        queryKey: ["new_solution"],
      });
      setView("queue");
    });

    return () => {
      cleanup();
    };
  }, []);

  // Dynamically update the window size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;

      // Get the actual dimensions of the content
      const height = containerRef.current.scrollHeight || 600;
      const width = containerRef.current.scrollWidth || 800;

      // Make sure we account for any open dialogs that might be outside the container
      const dialogs = document.querySelectorAll(
        '.dialog-content, [role="dialog"]'
      );
      let maxHeight = height;
      let maxWidth = width;

      // Check each dialog to see if it's larger than our container
      dialogs.forEach((dialog) => {
        if (dialog instanceof HTMLElement && dialog.offsetParent !== null) {
          // Dialog is visible - check its dimensions
          const dialogHeight = dialog.scrollHeight;
          const dialogWidth = dialog.scrollWidth;

          // Update max dimensions if dialog is larger
          maxHeight = Math.max(maxHeight, dialogHeight + 100); // Add padding
          maxWidth = Math.max(maxWidth, dialogWidth + 100); // Add padding
        }
      });

      // Update window dimensions with the larger of container or dialog dimensions
      window.electronAPI?.updateContentDimensions({
        width: maxWidth,
        height: maxHeight,
      });
    };

    // Force initial dimension update immediately
    updateDimensions();

    // Set a fallback timer to ensure dimensions are set even if content isn't fully loaded
    const fallbackTimer = setTimeout(() => {
      updateDimensions();
    }, 300);

    // Create observers to watch for content changes
    const resizeObserver = new ResizeObserver((entries) => {
      // Small delay to let animations complete
      setTimeout(updateDimensions, 50);
    });

    resizeObserver.observe(containerRef.current);

    // Watch the entire document for dialog changes
    const documentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "childList" ||
          (mutation.type === "attributes" &&
            mutation.target instanceof HTMLElement &&
            (mutation.target.classList.contains("dialog-content") ||
              mutation.target.getAttribute("role") === "dialog"))
        ) {
          // Dialog-related changes detected
          setTimeout(updateDimensions, 50);
          break;
        }
      }
    });

    documentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "role"],
    });

    // Do another update after a delay to catch any late-loading content
    const delayedUpdate = setTimeout(updateDimensions, 500);

    // And another one a bit later for really slow loading content
    const finalUpdate = setTimeout(updateDimensions, 1000);

    return () => {
      resizeObserver.disconnect();
      documentObserver.disconnect();
      clearTimeout(fallbackTimer);
      clearTimeout(delayedUpdate);
      clearTimeout(finalUpdate);
    };
  }, [view]); // Still depend on view changes, but handle other content changes internally

  // Listen for events that might switch views or show errors
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView("solutions");
      }),
      window.electronAPI.onSolutionSuccess((data: any) => {
        console.log("Solution success event received in renderer", {
          view,
          data,
        });
        // Ensure view is set correctly
        setView("solutions");
        // Rest of your handler
      }),
      window.electronAPI.onResetView(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"],
        });
        queryClient.removeQueries({
          queryKey: ["solution"],
        });
        queryClient.removeQueries({
          queryKey: ["problem_statement"],
        });
        setView("queue");
      }),
      window.electronAPI.onResetView(() => {
        queryClient.setQueryData(["problem_statement"], null);
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === "queue") {
          queryClient.invalidateQueries({
            queryKey: ["problem_statement"],
          });
          queryClient.setQueryData(["problem_statement"], data);
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Error", error, "error");
      }),
    ];
    return () => cleanupFunctions.forEach((fn) => fn());
  }, [view]);

  return (
    <div ref={containerRef} className="min-h-0">
      {view === "queue" ? (
        <Queue
          setView={setView}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : view === "solutions" ? (
        <Solutions
          setView={setView}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : null}
    </div>
  );
};

export default SubscribedApp;
