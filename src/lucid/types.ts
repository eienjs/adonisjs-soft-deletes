import type { NormalizeConstructor } from '@adonisjs/core/types/helpers';
import type { BaseModel } from '@adonisjs/lucid/orm';
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model';
import type { DateTime } from 'luxon';

export type ModelQueryBuilderContractWithIgnoreDeleted<T extends LucidModel, R = InstanceType<T>>
  = ModelQueryBuilderContract<T, R> & {
    ignoreDeleted: boolean;
  };

/**
 * Contract for a model instance with soft delete capabilities
 */
export interface SoftDeletableModelContract {
  $forceDelete: boolean;
  readonly $trashed: boolean;
  deletedAt?: DateTime | null;
  delete: () => Promise<void>;
  forceDelete: () => Promise<void>;
  restore: () => Promise<this>;
}

/**
 * Return type for the SoftDeletes mixin
 */
export type SoftDeletesModel<T extends NormalizeConstructor<typeof BaseModel>> = (new (
  ...args: unknown[]
) => InstanceType<T> & SoftDeletableModelContract) & {
  [K in keyof T]: T[K];
} & {
  disableIgnore: (query: unknown) => unknown;
  ignoreDeleted: (query: unknown) => void;
  ignoreDeletedPaginate: ([countQuery, query]: [unknown, unknown]) => void;
  onlyTrashed: () => unknown;
  withTrashed: () => unknown;
};

export type ModelWithSoftDeletes = LucidModel & {
  disableIgnore: (query: unknown) => unknown;
  ignoreDeleted: (query: unknown) => void;
  ignoreDeletedPaginate: ([countQuery, query]: [unknown, unknown]) => void;
  onlyTrashed: () => ModelQueryBuilderContract<LucidModel>;
  withTrashed: () => ModelQueryBuilderContract<LucidModel>;
};
