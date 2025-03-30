import { IModelProvider } from "./IModelProvider";
import axios from "axios";

export class OllamaProvider implements IModelProvider {
  chat = {
    completions: {
      async create(
        options: any
      ): Promise<{ choices: Array<{ message: { content: string } }> }> {
        const response = await axios.post(
          `http://localhost:11434/api/generate`,
          {
            model: options.model || "llama3",
            prompt: options.messages[options.messages.length - 1].content,
            stream: false,
          }
        );

        return {
          choices: [
            {
              message: {
                content: response.data.response,
              },
            },
          ],
        };
      },
    },
  };
  async debugSolution(
    problemInfo: any,
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Ollama provider is not initialized");
    }

    try {
      const prompt = `Debug this coding solution in ${language}:
            Problem Description: ${problemInfo.description}
            Current Solution: ${problemInfo.solution}
            Please analyze the code, identify potential bugs, and suggest improvements.
            Provide a corrected version with explanations.`;

      const response = await axios.post(`${this.baseUrl}/generate`, {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        images: imageDataList,
      });

      if (response.data && response.data.response) {
        return {
          debugInfo: response.data.response,
          language: language,
          timestamp: new Date().toISOString(),
        };
      }

      throw new Error("No valid response from Ollama");
    } catch (error) {
      console.error("Error debugging solution:", error);
      throw error;
    }
  }
  async generateSolution(problemInfo: any, language: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Ollama provider is not initialized");
    }

    try {
      const prompt = `Generate a solution for this programming problem in ${language}:
            Problem Description: ${problemInfo.description}
            Please provide a complete, working solution with comments explaining the approach.`;

      const response = await axios.post(`${this.baseUrl}/generate`, {
        model: this.modelName,
        prompt: prompt,
        stream: false,
      });

      if (response.data && response.data.response) {
        return {
          solution: response.data.response,
          language: language,
          timestamp: new Date().toISOString(),
        };
      }

      throw new Error("No valid response from Ollama");
    } catch (error) {
      console.error("Error generating solution:", error);
      throw error;
    }
  }
  async extractProblemInfo(
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.isConnected) {
      throw new Error("Ollama provider is not initialized");
    }

    try {
      const prompt = `Extract programming problem information from these images. The programming language is ${language}. 
        Analyze the images and provide: problem description, input/output examples, and any constraints.`;

      const response = await axios.post(`${this.baseUrl}/generate`, {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        images: imageDataList,
      });

      if (response.data && response.data.response) {
        return {
          description: response.data.response,
          language: language,
          timestamp: new Date().toISOString(),
        };
      }

      throw new Error("No valid response from Ollama");
    } catch (error) {
      console.error("Error extracting problem info:", error);
      throw error;
    }
  }
  private baseUrl: string = "http://localhost:11434/api";
  private modelName: string = "llama3";
  private isConnected: boolean = false;

  async initialize(config: any): Promise<boolean> {
    try {
      this.baseUrl = config.ollamaUrl || "http://localhost:11434/api";
      this.modelName = config.ollamaModel || "llama3";

      // Test connection
      const response = await axios.get(`${this.baseUrl}/tags`);
      this.isConnected = response.status === 200;
      return this.isConnected;
    } catch (error) {
      console.error("Failed to initialize Ollama client:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.isConnected;
  }

  // Implement the methods for Ollama
  // ...
}
