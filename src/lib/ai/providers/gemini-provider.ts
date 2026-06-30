/**
 * GeminiProvider
 * Implements AIProvider interface using Google Gemini API.
 * Generation model:  gemini-2.5-flash (exact string — do not change)
 * Embedding model:   text-embedding-004 (exact string — do not change)
 * All API calls go through GeminiKeyManager for key rotation.
 */

import type { AIProvider, EmbedTaskType, GenerateOptions, GenerateResult, EmbedResult } from '../ai-provider.interface'
import { getKeyManager } from './gemini-key-manager'

const GENERATION_MODEL = 'gemini-2.5-flash'
const EMBEDDING_MODEL  = 'text-embedding-004'
const BASE_URL         = 'https://generativelanguage.googleapis.com/v1beta'

export class GeminiProvider implements AIProvider {

  /**
   * Generate text using gemini-2.5-flash.
   * Uses round-robin key rotation via GeminiKeyManager.
   * Rotates key on HTTP 429. Throws immediately on other errors.
   */
  async generate(
    prompt: string,
    systemPrompt: string,
    options: GenerateOptions
  ): Promise<GenerateResult> {
    const manager = getKeyManager()

    // Retry loop for 429 handling
    for (let attempt = 0; attempt < 8; attempt++) {
      const { key, index } = await manager.getKey()

      const url = `${BASE_URL}/models/${GENERATION_MODEL}:generateContent?key=${key}`

      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.maxTokens,
          temperature: options.temperature,
        },
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (response.status === 429) {
          manager.markThrottled(index)
          manager.logCall(index, 429, 'generation', 'throttled')
          continue // retry with next key
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          manager.logCall(index, response.status, 'generation', 'error')
          throw new Error(
            `Gemini generation failed: HTTP ${response.status} — ${JSON.stringify(error)}`
          )
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

        manager.logCall(index, 200, 'generation', 'success')

        return {
          text,
          tokensUsed,
          keyIndexUsed: index,
          modelString: GENERATION_MODEL,
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('Gemini generation failed')) {
          throw error // non-retryable error
        }
        throw error
      }
    }

    throw new Error('Gemini generation failed: all 8 keys exhausted after retries.')
  }

  /**
   * Generate embeddings using text-embedding-004.
   * Dimension: 768 (fixed — never change).
   * Batch size: max 100 texts per call.
   */
  async embed(
    texts: string[],
    taskType: EmbedTaskType
  ): Promise<EmbedResult> {
    if (texts.length === 0) {
      return { vectors: [], dimension: 768 }
    }

    if (texts.length > 100) {
      throw new Error('Embedding batch size exceeded: max 100 texts per call.')
    }

    const manager = getKeyManager()

    for (let attempt = 0; attempt < 8; attempt++) {
      const { key, index } = await manager.getKey()

      const url = `${BASE_URL}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${key}`

      const body = {
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
        })),
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (response.status === 429) {
          manager.markThrottled(index)
          manager.logCall(index, 429, 'embedding', 'throttled')
          continue
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          manager.logCall(index, response.status, 'embedding', 'error')
          throw new Error(
            `Gemini embedding failed: HTTP ${response.status} — ${JSON.stringify(error)}`
          )
        }

        const data = await response.json()
        const vectors: number[][] = (data.embeddings ?? []).map(
          (e: { values: number[] }) => e.values
        )

        manager.logCall(index, 200, 'embedding', 'success')

        return { vectors, dimension: 768 }

      } catch (error) {
        if (error instanceof Error && error.message.includes('Gemini embedding failed')) {
          throw error
        }
        throw error
      }
    }

    throw new Error('Gemini embedding failed: all 8 keys exhausted after retries.')
  }
}
