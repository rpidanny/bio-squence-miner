import { LogLevel, LogOutputFormat, Quill } from '@rpidanny/quill'

import { LLMFactory } from '../../src/factories/llm'
import { SummaryMethod } from '../../src/services/llm/llm.service'
import { getDatasets } from './dataset'
import { SummaryEvaluator } from './summary-eval'

const logger = new Quill({ level: LogLevel.DEBUG, logOutputFormat: LogOutputFormat.TEXT })

enum Model {
  llama3_8b_instruct = 'llama3:instruct',
  gemma2_9b_instruct_q4_0 = 'gemma2:9b-instruct-q4_0',
  phi3_14b = 'phi3:14b',
  llama3_8b = 'llama3:8b',
}

const llmFactory = new LLMFactory()

const summaryEval = new SummaryEvaluator(
  {
    models: Object.values(Model),
    datasets: getDatasets(),
    methods: Object.values(SummaryMethod),
  },
  llmFactory,
  logger,
)

const result = await summaryEval.run()

logger.info('Final evaluation result:')
console.log(JSON.stringify(result, null, 2))