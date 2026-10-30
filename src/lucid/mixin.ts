import type { NormalizeConstructor } from '@adonisjs/core/types/helpers';
import type { BaseModel } from '@adonisjs/lucid/orm';
import type { QueryClientContract } from '@adonisjs/lucid/types/database';
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model';
import type { ModelQueryBuilderContractWithIgnoreDeleted, SoftDeletesModel } from './types.js';
import { Exception } from '@adonisjs/core/exceptions';
import { beforeFetch, beforeFind, beforePaginate, column } from '@adonisjs/lucid/orm';
import { DateTime } from 'luxon';

/**
 * Mixin that adds soft delete support to Lucid models
 */
export function SoftDeletes<T extends NormalizeConstructor<typeof BaseModel>>(
  superclass: T,
): SoftDeletesModel<T> {
  class ModelWithSoftDeletes extends superclass {
    /**
     * Force delete instance property
     */
    public $forceDelete = false;

    /**
     * Soft deleted property
     */
    @column.dateTime()
    declare public deletedAt?: DateTime | null;

    /**
     * Computed trashed property prefixed with $ to prevent collision with database columns
     */
    public get $trashed(): boolean {
      return Boolean(this.deletedAt);
    }

    /**
     * Override default $getQueryFor method to handle soft deleting
     */
    public override $getQueryFor(
      action: 'insert',
      client: QueryClientContract,
    ): ReturnType<QueryClientContract['insertQuery']>;

    public override $getQueryFor(
      action: 'update' | 'delete' | 'refresh',
      client: QueryClientContract,
    ): ModelQueryBuilderContract<LucidModel>;

    public override $getQueryFor(
      action: 'insert' | 'update' | 'delete' | 'refresh',
      client: QueryClientContract,
    ): unknown {
      const softDelete = async (): Promise<void> => {
        this.deletedAt = DateTime.local();
        await this.save();
      };

      if (action === 'delete' && !this.$forceDelete) {
        return { del: softDelete, delete: softDelete };
      }

      if (action === 'insert') {
        return super.$getQueryFor('insert', client);
      }

      return super.$getQueryFor(action, client);
    }

    /**
     * Override default delete method
     */
    public override async delete(): Promise<void> {
      await super.delete();
      this.$isDeleted = this.$forceDelete;
    }

    /**
     * Restore model
     */
    public async restore(): Promise<this> {
      if (this.$isDeleted) {
        throw new Exception('Cannot restore a model instance that was force deleted', {
          code: 'E_MODEL_FORCE_DELETED',
          status: 500,
        });
      }
      if (!this.$trashed) {
        return this;
      }
      this.deletedAt = null;
      await this.save();

      return this;
    }

    /**
     * Force delete model permanently
     */
    public async forceDelete(): Promise<void> {
      this.$forceDelete = true;
      await this.delete();
    }

    /**
     * Hook to exclude soft-deleted records from find/fetch queries
     */
    @beforeFind()
    @beforeFetch()
    public static ignoreDeleted<Model extends typeof ModelWithSoftDeletes>(
      query: ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>>,
    ): void {
      if (query.ignoreDeleted === false) {
        return;
      }

      const isGroupLimitQuery = query.clone().toQuery().includes('adonis_group_limit_counter');
      const deletedAtColumn = query.model.$getColumn('deletedAt')?.columnName ?? 'deleted_at';

      const singleTable = (query.knexQuery as unknown as { _single?: { table?: typeof query } } | undefined)
        ?._single
        ?.table;
      const queryIgnoreDeleted = isGroupLimitQuery && singleTable ? singleTable : query;

      void queryIgnoreDeleted.whereNull(`${query.model.table}.${deletedAtColumn}`);
    }

    /**
     * Hook to exclude soft-deleted records from pagination count queries
     */
    @beforePaginate()
    public static ignoreDeletedPaginate<Model extends typeof ModelWithSoftDeletes>([countQuery, query]: [
      ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>>,
      ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>>,
    ]): void {
      countQuery.ignoreDeleted = query.ignoreDeleted;
      this.ignoreDeleted(countQuery);
    }

    /**
     * Disables ignoring soft-deleted records on a query
     */
    public static disableIgnore<Model extends typeof ModelWithSoftDeletes, Result = InstanceType<Model>>(
      this: Model,
      query: ModelQueryBuilderContractWithIgnoreDeleted<Model, Result>,
    ): ModelQueryBuilderContractWithIgnoreDeleted<Model, Result> {
      if (query.ignoreDeleted === false) {
        return query;
      }
      query.ignoreDeleted = false;

      return query;
    }

    /**
     * Fetch all models without filter by deleted_at
     */
    public static withTrashed<Model extends typeof ModelWithSoftDeletes>(
      this: Model,
    ): ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>> {
      const query = this.query() as ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>>;

      return this.disableIgnore(query);
    }

    /**
     * Fetch models only with deleted_at
     */
    public static onlyTrashed<Model extends typeof ModelWithSoftDeletes>(
      this: Model,
    ): ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>> {
      const query = this.query() as ModelQueryBuilderContractWithIgnoreDeleted<Model, InstanceType<Model>>;
      const deletedAtColumn = query.model.$getColumn('deletedAt')?.columnName ?? 'deleted_at';

      return this.disableIgnore(query).whereNotNull(`${query.model.table}.${deletedAtColumn}`);
    }
  }

  return ModelWithSoftDeletes as unknown as SoftDeletesModel<T>;
}
