import { IModelProvider } from "./IModelProvider";
import axios from "axios";

async function resizeBase64Image(
  base64Data: string,
  maxWidth: number = 1024
): Promise<string> {
  try {
    // Import sharp dynamically to avoid issues if it's not installed
    const sharp = require("sharp");

    // Create a buffer from the base64 string
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Get image metadata to check dimensions
    const metadata = await sharp(imageBuffer).metadata();

    // If image is already small enough, return original
    if (metadata.width && metadata.width <= maxWidth) {
      return base64Data;
    }

    // Calculate new height maintaining aspect ratio
    const newHeight =
      metadata.width && metadata.height
        ? Math.round((maxWidth / metadata.width) * metadata.height)
        : undefined;

    // Resize the image
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(maxWidth, newHeight)
      .jpeg({ quality: 80 })
      .toBuffer();

    // Convert back to base64
    return resizedImageBuffer.toString("base64");
  } catch (error) {
    console.error("Error resizing image:", error);
    // Return original if resizing fails
    return base64Data;
  }
}

export class OllamaProvider implements IModelProvider {
  private baseUrl: string = "http://localhost:11434/api";
  private isConnected: boolean = false;

  chat = {
    completions: {
      async create(
        options: any
      ): Promise<{ choices: Array<{ message: { content: string } }> }> {
        // Extract the base URL from the options or use default
        const baseUrl = options.baseUrl || "http://localhost:11434/api";
        const model = options.model || "llama3.2-vision:11b";

        console.log(`Using Ollama model: ${model} for request`);

        // Process images if they exist in the messages
        let images: string[] = [];
        let textPrompt = "";
        let systemPrompt = "";

        // Extract system prompt if present
        if (
          options.messages &&
          options.messages.length > 0 &&
          options.messages[0].role === "system"
        ) {
          systemPrompt = options.messages[0].content;
        }

        // Extract text and images from the user messages
        if (options.messages && options.messages.length > 0) {
          // Get the user message (usually the last one)
          const userMessage =
            options.messages.find((m: { role: string }) => m.role === "user") ||
            options.messages[options.messages.length - 1];

          // If the message has content as an array (OpenAI multimodal format)
          if (Array.isArray(userMessage.content)) {
            userMessage.content.forEach((contentItem: any) => {
              if (contentItem.type === "text") {
                textPrompt += contentItem.text;
              } else if (
                contentItem.type === "image_url" &&
                contentItem.image_url
              ) {
                // Extract base64 from data URL
                const base64Match = contentItem.image_url.url.match(
                  /^data:image\/[a-z]+;base64,(.+)$/
                );
                if (base64Match && base64Match[1]) {
                  images.push(base64Match[1]);
                }
              }
            });
          } else {
            // If it's just a simple string
            textPrompt = userMessage.content;
          }
        }

        // Combine system prompt with user prompt if both exist
        const finalPrompt = systemPrompt
          ? `${systemPrompt}\n\n${textPrompt}`
          : textPrompt;

        if (images.length > 0) {
          try {
            console.log(
              `Resizing ${images.length} images to optimize memory usage...`
            );
            const resizedImages = await Promise.all(
              images.map((img) => resizeBase64Image(img, 1024))
            );
            images = resizedImages;
            console.log("Image resizing complete");
          } catch (resizeError) {
            console.warn("Could not resize images:", resizeError);
            // Continue with original images
          }
        }

        console.log(`Sending Ollama request with ${images.length} images`);

        // Prepare the API request data
        const requestData: any = {
          model: model,
          prompt: finalPrompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.2,
            top_p: options.top_p || 0.95,
            num_predict: options.max_tokens || 4000,
          },
        };

        // Add images if available
        if (images.length > 0) {
          requestData.images = images;
        }

        try {
          console.log(
            `Sending request to ${baseUrl}/generate with model ${model}`
          );

          // Make the API call
          const response = await axios.post(
            `${baseUrl}/generate`,
            requestData,
            {
              timeout: 120000, // 2-minute timeout
              headers: { "Content-Type": "application/json" },
            }
          );

          console.log(`Received response from Ollama`);

          return {
            choices: [
              {
                message: {
                  content: response.data.response,
                },
              },
            ],
          };
        } catch (error: any) {
          console.error("Ollama API error:", error.message);

          if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Response status:", error.response.status);
          }

          // Try again without images if the error is related to images
          if (images.length > 0) {
            console.log("Retrying without images...");
            try {
              const fallbackResponse = await axios.post(
                `${baseUrl}/generate`,
                {
                  model: model,
                  prompt: `${finalPrompt}\n\n(Note: There were images in this prompt but they couldn't be processed)`,
                  stream: false,
                  options: {
                    temperature: options.temperature || 0.2,
                    top_p: options.top_p || 0.95,
                    num_predict: options.max_tokens || 4000,
                  },
                },
                { timeout: 60000 }
              );

              return {
                choices: [
                  {
                    message: {
                      content: fallbackResponse.data.response,
                    },
                  },
                ],
              };
            } catch (fallbackError) {
              console.error("Fallback request also failed:", fallbackError);
              throw fallbackError;
            }
          }

          throw error;
        }
      },
    },
  };

  async initialize(config: any): Promise<boolean> {
    try {
      this.baseUrl = config.ollamaUrl || "http://localhost:11434/api";

      // Store the base URL for the chat.completions.create method
      (this.chat.completions.create as any).baseUrl = this.baseUrl;

      console.log(`Initializing Ollama with base URL: ${this.baseUrl}`);

      // Test connection and get available models
      const response = await axios.get(`${this.baseUrl}/tags`);

      if (response.status === 200) {
        this.isConnected = true;

        // Log available models to help with debugging
        const models = response.data.models || [];
        console.log(
          `Available Ollama models: ${models
            .map((m: { name: any }) => m.name)
            .join(", ")}`
        );

        // Check if we have vision models
        const visionModels = models.filter(
          (m: { name: string | string[] }) =>
            m.name.includes("vision") ||
            m.name.includes("llava") ||
            m.name.includes("gemma") ||
            m.name.includes("moondream")
        );

        console.log(
          `Available vision models: ${visionModels
            .map((m: { name: any }) => m.name)
            .join(", ")}`
        );
      }

      return this.isConnected;
    } catch (error) {
      console.error("Failed to initialize Ollama client:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.isConnected;
  }
}
