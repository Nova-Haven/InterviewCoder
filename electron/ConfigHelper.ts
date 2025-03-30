// ConfigHelper.ts
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { EventEmitter } from "events";
import { OpenAI } from "openai";

interface Config {
  modelProvider: string; // 'openai', 'gemini', or 'ollama'
  apiKey: string;
  geminiApiKey: string;
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  ollamaUrl: string;
  language: string;
  opacity: number;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    modelProvider: "openai", // 'openai', 'gemini', or 'ollama'
    apiKey: "",
    geminiApiKey: "",
    extractionModel: "gpt-4o",
    solutionModel: "gpt-4o",
    debuggingModel: "gpt-4o",
    ollamaUrl: "localhost:11434/api",
    language: "javascript",
    opacity: 1.0,
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath("userData"), "config.json");
      console.log("Config path:", this.configPath);
    } catch (err) {
      console.warn("Could not access user data path, using fallback");
      this.configPath = path.join(process.cwd(), "config.json");
    }

    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Load the configuration from disk
   */
  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        const config = JSON.parse(configData);

        return {
          ...this.defaultConfig,
          ...config,
        };
      }

      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);

      // Only emit update event for changes other than opacity
      // This prevents re-initializing the OpenAI client when only opacity changes
      if (
        updates.apiKey !== undefined ||
        updates.extractionModel !== undefined ||
        updates.solutionModel !== undefined ||
        updates.debuggingModel !== undefined ||
        updates.language !== undefined
      ) {
        this.emit("config-updated", newConfig);
      }

      return newConfig;
    } catch (error) {
      console.error("Error updating config:", error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();

    // Check the appropriate key based on provider type
    if (config.modelProvider === "openai") {
      return !!config.apiKey && config.apiKey.trim().length > 0;
    } else if (config.modelProvider === "gemini") {
      return !!config.geminiApiKey && config.geminiApiKey.trim().length > 0;
    } else if (config.modelProvider === "ollama") {
      return !!config.ollamaUrl && config.ollamaUrl.trim().length > 0;
    }

    return false;
  }

  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string): boolean {
    // Basic format validation for OpenAI API keys
    return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
  }

  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }

  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }

  /**
   * Test API key with OpenAI
   */
  public async testApiKey(
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error("API key test failed:", error);

      // Determine the specific error type for better error messages
      let errorMessage = "Unknown error validating API key";

      if (error.status === 401) {
        errorMessage = "Invalid API key. Please check your key and try again.";
      } else if (error.status === 429) {
        errorMessage =
          "Rate limit exceeded. Your API key has reached its request limit or has insufficient quota.";
      } else if (error.status === 500) {
        errorMessage = "OpenAI server error. Please try again later.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
