import * as oclif from '@oclif/core'
import { Odysseus } from '@rpidanny/odysseus'
import { Container } from 'typedi'

import { BaseCommand } from '../../base.command.js'
import { initSearchContainer } from '../../containers/search.container.js'
import keywordsArg from '../../inputs/args/keywords.arg.js'
import accessionNumberRegexFlag from '../../inputs/flags/accession-number-regex.flag.js'
import concurrencyFlag from '../../inputs/flags/concurrency.flag.js'
import countFlag from '../../inputs/flags/count.flag.js'
import headlessFlag from '../../inputs/flags/headless.flag.js'
import legacyFlag from '../../inputs/flags/legacy.flag.js'
import llmProviderFlag from '../../inputs/flags/llm-provider.flag.js'
import outputFlag from '../../inputs/flags/output.flag.js'
import questionFlag from '../../inputs/flags/question.flag.js'
import skipCaptchaFlag from '../../inputs/flags/skip-captcha.flag.js'
import summaryFlag from '../../inputs/flags/summary.flag.js'
import { PaperSearchService } from '../../services/search/paper-search.service.js'

export default class SearchAccession extends BaseCommand<typeof SearchAccession> {
  private odysseus!: Odysseus
  private searchService!: PaperSearchService

  static summary = 'Search and export papers containing accession numbers to a CSV file.'

  static deprecationOptions: oclif.Interfaces.Deprecation = {
    message: 'Use `darwin search papers` command with  `--find="PRJNA\\d+"` instead.',
    version: '1.13.0',
    to: 'search papers',
  }

  static examples = [
    '<%= config.bin %> <%= command.id %> --help',
    '<%= config.bin %> <%= command.id %> "mocrobiome, nRNA" --output ./ --count 10 --log-level DEBUG',
  ]

  static args = {
    keywords: keywordsArg,
  }

  static flags = {
    count: countFlag,
    concurrency: concurrencyFlag,
    output: outputFlag,
    'accession-number-regex': accessionNumberRegexFlag,
    'skip-captcha': skipCaptchaFlag,
    legacy: legacyFlag,
    headless: headlessFlag,
    summary: summaryFlag,
    llm: llmProviderFlag,
    question: questionFlag,
  }

  async init(): Promise<void> {
    await super.init()

    const {
      headless,
      concurrency,
      summary,
      llm: llmProvider,
      'skip-captcha': skipCaptcha,
      legacy,
    } = this.flags

    initSearchContainer(
      {
        headless,
        concurrency,
        summary,
        llmProvider,
        skipCaptcha,
        legacy,
      },
      this.localConfig,
      this.logger,
    )

    this.odysseus = Container.get(Odysseus)
    await this.odysseus.init()

    this.searchService = Container.get(PaperSearchService)
  }

  protected async finally(error: Error | undefined): Promise<void> {
    await super.finally(error)
    await this.odysseus?.close()
  }

  public async run(): Promise<void> {
    const { count, output, 'accession-number-regex': filterPattern, summary, question } = this.flags
    const { keywords } = this.args

    this.logger.info(`Searching papers with Accession Numbers (${filterPattern}) for: ${keywords}`)

    const outputPath = await this.searchService.exportToCSV(output, {
      keywords,
      minItemCount: count,
      filterPattern,
      summarize: summary,
      question,
    })

    this.logger.info(`Exported papers list to: ${outputPath}`)
  }
}
