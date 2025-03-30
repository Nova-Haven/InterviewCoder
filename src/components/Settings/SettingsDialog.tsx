import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../../contexts/toast";
import {
  modelsByProvider,
  ProviderType,
} from "../../../electron/models/ModelsList";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  open: externalOpen,
  onOpenChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [modelProvider, setModelProvider] = useState<ProviderType>("openai");

  // API keys for different providers
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434/api");

  // Model selections
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");

  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };

  // Reset models when provider changes
  useEffect(() => {
    // Set default models for the selected provider
    if (modelProvider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (modelProvider === "gemini") {
      setExtractionModel("gemini-2.0-flash");
      setSolutionModel("gemini-pro");
      setDebuggingModel("gemini-2.0-flash");
    } else if (modelProvider === "ollama") {
      setExtractionModel("llama3");
      setSolutionModel("llama3");
      setDebuggingModel("llama3");
    }
  }, [modelProvider]);

  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      window.electronAPI
        .getConfig()
        .then((config: any) => {
          // Set provider type
          setModelProvider(config.modelProvider || "openai");

          // Set API keys
          setOpenaiApiKey(config.apiKey || "");
          setGeminiApiKey(config.geminiApiKey || "");
          setOllamaUrl(config.ollamaUrl || "http://localhost:11434/api");

          // Set models
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
        })
        .catch((error: any) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Prepare config object based on selected provider
      const configToSave: any = {
        modelProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
      };

      // Add provider-specific settings
      if (modelProvider === "openai") {
        configToSave.apiKey = openaiApiKey;
      } else if (modelProvider === "gemini") {
        configToSave.geminiApiKey = geminiApiKey;
      } else if (modelProvider === "ollama") {
        configToSave.ollamaUrl = ollamaUrl;
      }

      const result = await window.electronAPI.updateConfig(configToSave);

      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  // Get current provider's API key input field
  const renderProviderApiSettings = () => {
    switch (modelProvider) {
      case "openai":
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
              OpenAI API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="bg-black/50 border-white/10 text-white"
            />
            {openaiApiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(openaiApiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except
              OpenAI
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">
                Don't have an API key?
              </p>
              <p className="text-xs text-white/60 mb-1">
                1. Create an account at{" "}
                <button
                  onClick={() =>
                    openExternalLink("https://platform.openai.com/signup")
                  }
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  OpenAI
                </button>
              </p>
              <p className="text-xs text-white/60 mb-1">
                2. Go to{" "}
                <button
                  onClick={() =>
                    openExternalLink("https://platform.openai.com/api-keys")
                  }
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  API Keys
                </button>{" "}
                section
              </p>
              <p className="text-xs text-white/60">
                3. Create a new secret key and paste it here
              </p>
            </div>
          </div>
        );
      case "gemini":
        return (
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-white"
              htmlFor="geminiApiKey"
            >
              Google AI API Key
            </label>
            <Input
              id="geminiApiKey"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AI..."
              className="bg-black/50 border-white/10 text-white"
            />
            {geminiApiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(geminiApiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except
              Google AI
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">
                Don't have a Google AI API key?
              </p>
              <p className="text-xs text-white/60 mb-1">
                1. Get an API key from{" "}
                <button
                  onClick={() => openExternalLink("https://ai.google.dev/")}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  Google AI Studio
                </button>
              </p>
              <p className="text-xs text-white/60">
                2. Create a new API key and paste it here
              </p>
            </div>
          </div>
        );
      case "ollama":
        return (
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-white"
              htmlFor="ollamaUrl"
            >
              Ollama API URL
            </label>
            <Input
              id="ollamaUrl"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434/api"
              className="bg-black/50 border-white/10 text-white"
            />
            <p className="text-xs text-white/50">
              URL of your local Ollama instance (default:
              http://localhost:11434/api)
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">
                Don't have Ollama installed?
              </p>
              <p className="text-xs text-white/60 mb-1">
                1. Download and install Ollama from{" "}
                <button
                  onClick={() =>
                    openExternalLink("https://ollama.com/download")
                  }
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  ollama.com
                </button>
              </p>
              <p className="text-xs text-white/60">
                2. Run Ollama locally and make sure it's accessible at the URL
                above
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(550px, 90vw)",
          height: "auto",
          minHeight: "400px",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 9999,
          margin: 0,
          padding: "20px",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          animation: "fadeIn 0.25s ease forwards",
          opacity: 0.98,
        }}
      >
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API provider, key and model preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Select AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-3 rounded-lg cursor-pointer text-center transition-colors ${
                  modelProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => setModelProvider("openai")}
              >
                <p className="font-medium text-white text-sm">OpenAI</p>
              </div>
              <div
                className={`p-3 rounded-lg cursor-pointer text-center transition-colors ${
                  modelProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => setModelProvider("gemini")}
              >
                <p className="font-medium text-white text-sm">Google Gemini</p>
              </div>
              <div
                className={`p-3 rounded-lg cursor-pointer text-center transition-colors ${
                  modelProvider === "ollama"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => setModelProvider("ollama")}
              >
                <p className="font-medium text-white text-sm">Ollama (Local)</p>
              </div>
            </div>
          </div>

          {/* Provider-specific API settings */}
          {renderProviderApiSettings()}

          {/* Model selection for the current provider */}
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">
              AI Model Selection
            </label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>

            {/* Problem Extraction Models */}
            <div className="mb-4">
              <label className="text-sm font-medium text-white mb-1 block">
                Problem Extraction
              </label>
              <p className="text-xs text-white/60 mb-2">
                Model used to analyze screenshots and extract problem details
              </p>

              <div className="space-y-2">
                {modelsByProvider[modelProvider].extractionModel.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      extractionModel === m.id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                    onClick={() => setExtractionModel(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          extractionModel === m.id ? "bg-white" : "bg-white/20"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-white text-xs">
                          {m.name}
                        </p>
                        <p className="text-xs text-white/60">{m.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution Generation Models */}
            <div className="mb-4">
              <label className="text-sm font-medium text-white mb-1 block">
                Solution Generation
              </label>
              <p className="text-xs text-white/60 mb-2">
                Model used to generate coding solutions
              </p>

              <div className="space-y-2">
                {modelsByProvider[modelProvider].solutionModel.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      solutionModel === m.id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                    onClick={() => setSolutionModel(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          solutionModel === m.id ? "bg-white" : "bg-white/20"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-white text-xs">
                          {m.name}
                        </p>
                        <p className="text-xs text-white/60">{m.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Debugging Models */}
            <div className="mb-4">
              <label className="text-sm font-medium text-white mb-1 block">
                Debugging
              </label>
              <p className="text-xs text-white/60 mb-2">
                Model used to debug and improve solutions
              </p>

              <div className="space-y-2">
                {modelsByProvider[modelProvider].debuggingModel.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      debuggingModel === m.id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                    onClick={() => setDebuggingModel(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          debuggingModel === m.id ? "bg-white" : "bg-white/20"
                        }`}
                      />
                      <div>
                        <p className="font-medium text-white text-xs">
                          {m.name}
                        </p>
                        <p className="text-xs text-white/60">{m.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts section - unchanged */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">
              Keyboard Shortcuts
            </label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                {/* Rest of shortcuts unchanged */}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={
              isLoading ||
              (modelProvider === "openai" && !openaiApiKey) ||
              (modelProvider === "gemini" && !geminiApiKey) ||
              (modelProvider === "ollama" && !ollamaUrl)
            }
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
