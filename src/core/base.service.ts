import {
  Repository,
  FindOneOptions,
  FindManyOptions,
  FindConditions,
} from 'typeorm';
import {
  NotFoundException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Validator } from 'class-validator';
import { parseQuery } from './typeorm/parse-to-orm-query';
import { paginate } from './pagination/_paginate.helper';
import { OrmWhere, WithId } from './types';
import { PgResult } from './pagination/pagination.types';
import { PaginationParams } from './pagination/pagination-options';
import { Log } from './logger/log.entity';
import { DbLoggerService } from './logger/db-logger.service';
import { LogMetadata } from './logger/log-metadata';

type FindOneParams<T> = Omit<FindOneOptions<T>, 'where'>;
type FindManyParams<T> = Omit<FindManyOptions<T>, 'where'>;

/**
 * Base service that implements some basic crud methods.
 * Services are in change of throwing HTTP errors.
 * There is no need for every controller to check if result
 * is null, this service will automatically check for him.
 * @warning Don't return promise directly. If repo throw an error,
 * service should catch her and pass error that can be shown
 * to users.
 */
export abstract class BaseService<T extends WithId = any> {
  constructor(
    protected readonly repository: Repository<T>,
    @Optional() protected readonly dbLoggerService?: DbLoggerService<T>,
  ) {}

  /** Logger */
  protected logger = new Logger();

  /** Validator */
  protected validator = new Validator();

  /**
   * Find companies that match criteria
   * If filter is string or number it will search for Id
   * @example Left is passed value, right is parsed
   *  ({ price__lt: 5 } => { price: LessThan(5) })
   */
  async findOne(
    filter: OrmWhere<T> | number,
    options: FindOneParams<T> = {},
  ): Promise<T> {
    let entity: T | undefined;
    let where;

    // If string or number, then search by id
    where =
      typeof filter === 'string' || typeof filter === 'number'
        ? { id: filter }
        : filter;
    where = parseQuery(where);

    try {
      entity = await this.repository.findOne({ ...options, where });
    } catch (error) {
      throw this.internalError(error);
    }

    return this.throwIfNotFound(entity);
  }

  async findByIds(ids: (string | number)[]): Promise<T[]> {
    try {
      const entities = await this.repository.findByIds(ids);
      return entities;
    } catch (error) {
      throw this.internalError(error);
    }
  }

  /**
   * Find companies that match criteria
   */
  async find(filter: OrmWhere<T> = {}): Promise<T[]> {
    try {
      const res = await this.repository.find({ where: parseQuery(filter) });
      return res;
    } catch (error) {
      throw this.internalError(error);
    }
  }

  /**
   * Find entities that match criteria with pagination.
   * Pagination has it's own error handling. Don't handle errors twice
   * You can pass where query in options object or as a second param
   */
  async paginate(
    options: PaginationParams<T>,
    where?: OrmWhere<T>,
  ): PgResult<T> {
    const { repository } = this;
    const combinedOptions = { ...options };
    if (
      typeof combinedOptions.where === 'object' &&
      typeof where === 'object'
    ) {
      combinedOptions.where = { ...combinedOptions.where, ...where };
    } else {
      combinedOptions.where = where;
    }
    combinedOptions.where = parseQuery(combinedOptions.where);

    const paginated = await paginate({ repository, options: combinedOptions });
    return paginated;
  }

  /** Create new entity */
  async create(data: Partial<T>, meta?: LogMetadata): Promise<T> {
    try {
      const entity = this.repository.create(data);
      const savedEntity = await this.repository.save(entity);

      if (this.dbLoggerService && meta) {
        const log = this.dbLoggerService.generateLog({ meta });
        await this.dbLoggerService.store(log, 'create', savedEntity);
      }

      return savedEntity;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /** Update entity */
  async update(
    entityOrId: T | string,
    data: Partial<T> = {},
    meta?: LogMetadata,
  ): Promise<T> {
    try {
      const entity = await this.findOne(entityOrId);
      // const entity = await this.convertToEntity(entityOrId);
      let log: Log | undefined;

      if (this.dbLoggerService && meta) {
        log = this.dbLoggerService.generateLog({ meta, oldValue: entity });
      }

      this.repository.merge(entity, data);
      const updatedEntity = await this.repository.save(entity);

      if (this.dbLoggerService && log) {
        await this.dbLoggerService.store(log, 'update', updatedEntity);
      }

      return updatedEntity;
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  /**
   * Accepts mutated entity, instead of original entity and changes.
   * Used when entities have special setters.
   */
  async mutate(entity: T, meta?: LogMetadata): Promise<T> {
    try {
      let log: Log | undefined;
      const oldValue = await this.findOne(entity.id);

      if (this.dbLoggerService && meta) {
        log = this.dbLoggerService.generateLog({ meta, oldValue });
      }
      const mutatedEntity = await this.repository.save(entity);

      if (this.dbLoggerService && log) {
        await this.dbLoggerService.store(log, 'update', mutatedEntity);
      }
      return mutatedEntity;
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  /** Update entity by providing where clause. Only one entity updated. */
  async updateWhere(
    where: FindConditions<T>,
    data: Partial<T>,
    meta?: LogMetadata,
  ): Promise<T> {
    const entity = await this.findOne(where);
    const updated = await this.update(entity, data, meta);
    return updated;
  }

  /** Remove entity. */
  async delete(entityOrId: T | string, meta?: LogMetadata): Promise<T> {
    try {
      const entity = await this.convertToEntity(entityOrId);
      let log: Log | undefined;

      if (this.dbLoggerService && meta) {
        log = this.dbLoggerService.generateLog({ oldValue: entity, meta });
      }

      const deleted = await this.repository.remove(entity);

      if (this.dbLoggerService && log !== undefined) {
        await this.dbLoggerService.store(log, 'delete');
      }

      return deleted;
    } catch (error) {
      throw this.internalError(error);
    }
  }

  /**
   * Delete first entity that match condition.
   * Useful when need more validation.
   * This will delete only if id match, but also parent match
   * Deletion will always be logged if logService is provided
   * @example
   *  where = {id: someId, parentId: someParentId}
   */
  async deleteWhere(
    where: FindConditions<T>,
    logMetadata?: LogMetadata,
  ): Promise<T> {
    const entity = await this.findOne(where);
    const deleted = await this.delete(entity, logMetadata);
    return deleted;
  }

  /** Count result of a query */
  async count(
    filter: OrmWhere<T>,
    searchOptions: FindManyParams<T> = {},
  ): Promise<number> {
    try {
      const count = await this.repository.count({
        ...searchOptions,
        where: parseQuery(filter),
      });
      return count;
    } catch (error) {
      throw this.internalError(error);
    }
  }

  /**
   * If provided entity return that entity,
   * if provided string it will assume it's Id andtry to find in db.
   * If not found throw an exception.
   */
  protected async convertToEntity(entityOrId: T | string): Promise<T> {
    let entity: T | undefined;
    if (typeof entityOrId === 'string') {
      entity = await this.repository.findOne(entityOrId);
      entity = this.throwIfNotFound(entity);
    } else {
      entity = entityOrId;
    }
    return entity;
  }

  /** Throw exception if entity is undefined. Simple helper function */
  protected throwIfNotFound(entity: T | undefined): T {
    if (!entity) throw new NotFoundException();
    return entity;
  }

  protected internalError(error: any): InternalServerErrorException {
    this.logger.error(error);
    return new InternalServerErrorException();
  }
}
