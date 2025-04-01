// Interface for all model providers
export interface IModelProvider {
  initialize(config: any): Promise<boolean>;
  isInitialized(): boolean;

  chat: {
    completions: {
      create(options: any): Promise<{
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      }>;
    };
  };
}
