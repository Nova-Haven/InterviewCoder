// Interface for all model providers
export interface IModelProvider {
  initialize(config: any): Promise<boolean>;
  extractProblemInfo(imageDataList: string[], language: string): Promise<any>;
  generateSolution(problemInfo: any, language: string): Promise<any>;
  debugSolution(
    problemInfo: any,
    imageDataList: string[],
    language: string
  ): Promise<any>;
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
