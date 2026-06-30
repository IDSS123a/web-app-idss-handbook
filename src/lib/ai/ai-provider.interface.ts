/**
 * AI Provider Interface
 * All AI operations go through this interface — never call provider SDKs directly.
 * Swapping providers (Gemini → Claude → OpenAI) requires only a new implementation class.
 */

export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

export type GenerateOptions = {
  maxTokens: 512 | 2048 | 8192
  temperature: 0.3 | 0.7
  language?: 'bs' | 'de' | 'en'
}

export type GenerateResult = {
  text: string
  tokensUsed: number
  keyIndexUsed: number
  modelString: string
}

export type EmbedResult = {
  vectors: number[][]
  dimension: 768
}

export interface AIProvider {
  generate(
    prompt: string,
    systemPrompt: string,
    options: GenerateOptions
  ): Promise<GenerateResult>

  embed(
    texts: string[],
    taskType: EmbedTaskType
  ): Promise<EmbedResult>
}
