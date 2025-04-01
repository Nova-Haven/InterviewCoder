import { OpenAI } from "openai";
import { IModelProvider } from "./IModelProvider";

export class OpenAIProvider implements IModelProvider {
  chat = {
    completions: {
      create: async (options: any) => {
        if (!this.client) {
          throw new Error("OpenAI client not initialized");
        }
        return this.client.chat.completions.create(options);
      },
    },
  };

  private client: OpenAI | null = null;

  async initialize(config: any): Promise<boolean> {
    try {
      if (!config.apiKey) return false;

      this.client = new OpenAI({
        apiKey: config.apiKey,
        timeout: 60000,
        maxRetries: 2,
      });
      return true;
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }
}
