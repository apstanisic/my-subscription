import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import * as moment from 'moment';
import { LessThan, Repository, FindConditions, DeleteResult } from 'typeorm';
import { BaseService } from '../core/base.service';
import { CronService } from '../core/cron/cron.service';
import { Notification } from './notification.entity';
import { UUID } from '../core/types';

interface AddNotificationParams {
  title: string;
  body?: string;
  userId: UUID;
}

@Injectable()
export class NotificationService extends BaseService<Notification> {
  /** Cron job */

  constructor(
    @InjectRepository(Notification) repository: Repository<Notification>,
    private readonly cronService: CronService,
  ) {
    super(repository);
  }

  /** Delete many notifications. Expose deleteMany because of cron job */
  deleteMany(criteria: FindConditions<Notification>): Promise<DeleteResult> {
    return this.repository.delete(criteria);
  }

  async addNotification({
    title,
    body,
    userId,
  }: AddNotificationParams): Promise<Notification> {
    return this.create({ body, title, userId });
  }

  /** Deletes old notifications after six months. This should be done in cron */
  private async deleteOldNotifications(): Promise<void> {
    const sixMonthsBefore = moment()
      .subtract(6, 'months')
      .toDate();

    await this.repository.delete({ createdAt: LessThan(sixMonthsBefore) });
  }
}
