import { Runnable } from '@langchain/core/runnables'
import { Quill } from '@rpidanny/quill'
import { createWriteStream, WriteStream } from 'fs'
import moment from 'moment'
import pRetry from 'p-retry'

import { LLMProvider, TConfig } from '../../src/config/schema'
import { LLMFactory } from '../../src/factories/llm'
import { LLMService, SummaryMethod } from '../../src/services/llm/llm.service'
import { IDataset } from './dataset'
import { EVAL_PROMPT_TEMPLATE } from './prompt'

export interface SummaryEvalOptions {
  models: string[]
  datasets: IDataset[]
  methods: SummaryMethod[]
}

export interface EvaluationScore {
  score: number
}

export interface SummaryEvaluationResult {
  [model: string]: {
    mean: number
    std: number
    median: number
  }
}

export interface IPaperSummary {
  model: string
  method: string
  src: string
  abstract: string
  summary: string
}

export class SummaryEvaluator {
  private coreModelName = 'gemma2:9b-instruct-q4_0'
  private evaluationChain: Runnable

  private summariesPath = './eval/summary/output/summaries'
  private scoresPath = './eval/summary/output/scores'
  private summaryWriteStream: WriteStream
  private scoresWriteStream: WriteStream
  private runId = moment().format('YYYY-MM-DD-HH-mm-ss')

  constructor(
    private readonly options: SummaryEvalOptions,
    private readonly llmFactory: LLMFactory,
    private readonly logger: Quill,
  ) {
    const coreLlm = this.llmFactory.getLLM(LLMProvider.Ollama, this.getConfig(this.coreModelName))
    this.evaluationChain = EVAL_PROMPT_TEMPLATE.pipe(coreLlm)

    this.summaryWriteStream = createWriteStream(`${this.summariesPath}/${this.runId}.jsonl`, {
      flags: 'a',
    })
    this.scoresWriteStream = createWriteStream(`${this.scoresPath}/${this.runId}.jsonl`, {
      flags: 'a',
    })
  }

  private getConfig(modelName: string): TConfig {
    return { ollama: { model: modelName, baseUrl: 'http://localhost:11434' } }
  }

  private async generateSummaries(): Promise<Map<string, IPaperSummary[]>> {
    this.logger.info('Generating summaries...')

    const summaryMap = new Map<string, IPaperSummary[]>()

    const { models, datasets, methods } = this.options

    for (const model of models) {
      this.logger.debug(`Model: ${model}`)
      for (const dataset of datasets) {
        this.logger.debug(`Dataset: ${dataset.name}`)
        for (const method of methods) {
          this.logger.debug(`Method: ${method}`)
          const summary = await this.generateSummary(model, dataset, method)
          if (!summaryMap.has(dataset.name)) {
            summaryMap.set(dataset.name, [])
          }
          summaryMap
            .get(dataset.name)
            ?.push({ model, method, summary, abstract: dataset.abstract, src: dataset.name })
        }
      }
    }

    return summaryMap
  }

  private async generateSummary(
    model: string,
    dataset: IDataset,
    method: SummaryMethod,
  ): Promise<string> {
    const llmService = new LLMService(
      this.llmFactory.getLLM(LLMProvider.Ollama, this.getConfig(model)),
    )
    const summary = await pRetry(() => llmService.summarize(dataset.paper, method), { retries: 3 })

    this.summaryWriteStream.write(
      JSON.stringify({
        model: model,
        method,
        abstract: dataset.abstract,
        summary,
      }) + '\n',
    )

    return summary
  }

  private async evaluateSummary({
    summary,
    abstract,
    model,
    method,
    src,
  }: IPaperSummary): Promise<EvaluationScore> {
    const evaluation = await pRetry(
      async () => JSON.parse(await this.evaluationChain.invoke({ summary, abstract })),
      { retries: 3 },
    )
    this.scoresWriteStream.write(
      JSON.stringify({
        src,
        model,
        method,
        abstract,
        summary,
        score: evaluation.score,
      }) + '\n',
    )
    return evaluation
  }

  private async aggregateScores(scores: Map<string, number[]>): Promise<SummaryEvaluationResult> {
    const result: SummaryEvaluationResult = {}

    for (const [key, scoreList] of scores) {
      const mean = scoreList.reduce((acc, score) => acc + score, 0) / scoreList.length
      const std = Math.sqrt(
        scoreList.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scoreList.length,
      )
      const median = scoreList.sort((a, b) => a - b)[Math.floor(scoreList.length / 2)]

      result[key] = { mean, std, median }
    }
    return result
  }

  public async run(iterations = 1): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      this.logger.info(`Iteration ${i + 1}`)
      const summariesMap = await this.generateSummaries()
      for (const [dataset, summaries] of summariesMap) {
        this.logger.info(`Evaluating summaries for dataset: ${dataset}`)
        const scores = new Map<string, number[]>()

        for (const summary of summaries) {
          const key = `${summary.model}-${summary.method}`
          this.logger.info(`Evaluating summary for ${key}`)
          const { score } = await this.evaluateSummary(summary)
          if (!scores.has(key)) {
            scores.set(key, [])
          }
          scores.get(key)?.push(score)
          this.logger.info(`Score: ${score}`)
        }

        const aggregatedScores = await this.aggregateScores(scores)
        this.logger.info(JSON.stringify(aggregatedScores, null, 2))
      }
    }
  }
}
