import { IModelProvider } from "./IModelProvider";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class GeminiProvider implements IModelProvider {
  private models: {
    extraction: GenerativeModel | null;
    solution: GenerativeModel | null;
    debugging: GenerativeModel | null;
  } = {
    extraction: null,
    solution: null,
    debugging: null,
  };
  private genAI: GoogleGenerativeAI | null = null;
  private config: any = null;

  async initialize(config: any): Promise<boolean> {
    try {
      if (!config.geminiApiKey) return false;

      this.config = config;
      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);

      // Initialize each specialized model
      const extractionModel = config.extractionModel || "gemini-2.0-flash";
      const solutionModel = config.solutionModel || "gemini-2.0-flash";
      const debuggingModel = config.debuggingModel || "gemini-2.0-flash";

      console.log(`Initializing Gemini models:
        - Extraction: ${extractionModel}
        - Solution: ${solutionModel}
        - Debugging: ${debuggingModel}`);

      // Initialize the specialized models
      this.models.extraction = this.genAI.getGenerativeModel({
        model: extractionModel,
      });

      this.models.solution = this.genAI.getGenerativeModel({
        model: solutionModel,
      });

      this.models.debugging = this.genAI.getGenerativeModel({
        model: debuggingModel,
      });

      return true;
    } catch (error) {
      console.error("Failed to initialize Gemini models:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return (
      this.models.extraction !== null &&
      this.models.solution !== null &&
      this.models.debugging !== null
    );
  }

  // Helper to get the appropriate model based on the request
  private getModelForTask(options: any): GenerativeModel {
    // Default to extraction model if not specified
    if (!options || !options.model) {
      return this.models.extraction!;
    }

    // Map the requested model to our specialized models
    const modelName = options.model;

    // If the model name matches one of our config models, use the corresponding model
    if (modelName === this.config.extractionModel) {
      return this.models.extraction!;
    } else if (modelName === this.config.solutionModel) {
      return this.models.solution!;
    } else if (modelName === this.config.debuggingModel) {
      return this.models.debugging!;
    }

    // Default fallback based on the type of task
    if (options.messages && options.messages.length > 0) {
      // Check for image content which indicates extraction
      const firstMessage = options.messages[0];
      if (Array.isArray(firstMessage.content)) {
        for (const item of firstMessage.content) {
          if (item.type === "image_url") {
            return this.models.extraction!;
          }
        }
      }
    }

    // Default to solution model if we can't determine
    return this.models.solution!;
  }

  chat = {
    completions: {
      create: async (options: any) => {
        if (!this.isInitialized()) {
          throw new Error("Gemini models not initialized");
        }

        try {
          // Get the appropriate model for this task
          const model = this.getModelForTask(options);
          console.log(`Using Gemini model: ${(model as any).model}`);

          // Extract options that Gemini needs
          const { messages, temperature = 0.7 } = options;

          // Handle different message formats
          const geminiParts: any[] = [];

          // Process each message
          for (const message of messages) {
            if (message.role === "system") {
              // Add system message as text
              geminiParts.push({
                text: `System instruction: ${message.content}`,
              });
              continue;
            }

            // Handle content array (multimodal) or string (text-only)
            if (typeof message.content === "string") {
              geminiParts.push({
                text: message.content,
              });
            } else if (Array.isArray(message.content)) {
              // Process each content item
              for (const item of message.content) {
                if (item.type === "text") {
                  geminiParts.push({
                    text: item.text,
                  });
                } else if (item.type === "image_url") {
                  // Extract base64 data
                  const urlData = item.image_url.url;
                  if (urlData.startsWith("data:image/")) {
                    const base64Data = urlData.split(",")[1];
                    geminiParts.push({
                      inlineData: {
                        data: base64Data,
                        mimeType: "image/png",
                      },
                    });
                  }
                }
              }
            }
          }

          console.log(`Sending ${geminiParts.length} parts to Gemini`);

          // Set generation config
          const generationConfig = {
            temperature: temperature,
            maxOutputTokens: options.max_tokens || 4000,
          };

          // Generate content
          const result = await model.generateContent({
            contents: [{ role: "user", parts: geminiParts }],
            generationConfig: generationConfig,
          });

          const response = result.response;
          const text = response.text();

          console.log("Gemini response received, length:", text.length);

          // Return in a format compatible with OpenAI
          return {
            choices: [
              {
                message: {
                  content: text,
                },
              },
            ],
          };
        } catch (error) {
          console.error("Error in Gemini.chat.completions.create:", error);
          throw error;
        }
      },
    },
  };
}
