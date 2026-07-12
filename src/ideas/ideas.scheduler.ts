import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { Repository } from 'typeorm';
import { IdeaGenerationSettingsEntity } from './entities/idea-generation-settings.entity';
import {
  buildIdeaGenerationCronExpression,
  calculateNextIdeaRunAt,
} from './idea-generation-schedule';
import { IdeasService } from './ideas.service';

@Injectable()
export class IdeasScheduler implements OnModuleInit {
  private readonly logger = new Logger(IdeasScheduler.name);
  private readonly jobPrefix = 'idea-generation';

  constructor(
    private readonly ideasService: IdeasService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(IdeaGenerationSettingsEntity)
    private readonly settingsRepository: Repository<IdeaGenerationSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const settingsList = await this.settingsRepository.find({
      where: { enabled: true },
      relations: { agency: true },
    });

    settingsList.forEach((settings) => this.syncSetting(settings));
  }

  async syncAgencySchedule(agencyId: string): Promise<void> {
    const settings = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      relations: { agency: true },
    });

    if (!settings) {
      return;
    }

    this.syncSetting(settings);
  }

  syncSetting(settings: IdeaGenerationSettingsEntity): void {
    const jobName = this.getJobName(settings);
    this.deleteJob(jobName);

    if (!settings.enabled || !settings.theme?.trim()) {
      return;
    }

    const cronExpression = buildIdeaGenerationCronExpression(settings);
    const timezone = settings.timezone?.trim() || 'Europe/Paris';
    const job = CronJob.from({
      cronTime: cronExpression,
      onTick: () => this.runScheduledSettings(settings.id),
      start: false,
      timeZone: timezone,
      waitForCompletion: true,
      errorHandler: (error) =>
        this.logger.error(
          `Scheduled idea generation job failed for agency ${settings.agency.id}: ${String(
            error,
          )}`,
        ),
      name: jobName,
    });

    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();

    this.logger.log(
      `Scheduled idea generation for agency ${settings.agency.id}: ${cronExpression} (${timezone})`,
    );
  }

  private async runScheduledSettings(settingsId: string): Promise<void> {
    const now = new Date();
    const settings = await this.settingsRepository.findOne({
      where: { id: settingsId },
      relations: { agency: true },
    });

    if (!settings?.enabled || !settings.theme?.trim()) {
      return;
    }

    try {
      this.logger.log(
        `Running scheduled idea generation for agency ${settings.agency.id}`,
      );
      await this.ideasService.generateFromSettings(settings);
    } catch (error) {
      this.logger.error(
        `Scheduled idea generation failed for agency ${settings.agency.id}: ${String(
          error,
        )}`,
      );
    } finally {
      settings.lastRunAt = now;
      settings.nextRunAt = calculateNextIdeaRunAt(settings, now);
      await this.settingsRepository.save(settings);
    }
  }

  private getJobName(settings: IdeaGenerationSettingsEntity) {
    return `${this.jobPrefix}:${settings.id}`;
  }

  private deleteJob(jobName: string): void {
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      const job = this.schedulerRegistry.getCronJob(jobName);
      void job.stop();
      this.schedulerRegistry.deleteCronJob(jobName);
    }
  }
}
