/* eslint-disable @typescript-eslint/promise-function-async */
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model';
import type { ModelWithSoftDeletes } from '../types.js';
import { Exception } from '@adonisjs/core/exceptions';

export interface MacroableQueryBuilder {
  hasMacro?: (name: string) => boolean;
  macro: (name: string, fn: unknown) => void;
  prototype?: object;
}

/**
 * Checks whether builder already has the macro
 */
function hasMacro(builder: MacroableQueryBuilder, name: string): boolean {
  if (typeof builder.hasMacro === 'function') {
    return builder.hasMacro(name);
  }

  return Boolean(builder.prototype && Reflect.has(builder.prototype, name));
}

/**
 * Raises exception when model does not support soft deletes
 */
function ensureModelWithSoftDeletes(model: LucidModel): asserts model is ModelWithSoftDeletes {
  if (!('ignoreDeleted' in model && 'ignoreDeletedPaginate' in model)) {
    throw new Exception(`${model.name} model does not support Soft Deletes`, {
      code: 'E_MODEL_SOFT_DELETE',
      status: 500,
    });
  }
}

/**
 * Define SoftDeletes macros on Lucid ModelQueryBuilder
 */
export function extendModelQueryBuilder(builder: MacroableQueryBuilder): void {
  if (!hasMacro(builder, 'restore')) {
    builder.macro('restore', function (this: ModelQueryBuilderContract<LucidModel>) {
      ensureModelWithSoftDeletes(this.model);

      const deletedAtColumn = this.model.$getColumn('deletedAt')?.columnName ?? 'deleted_at';

      return this.update({ [deletedAtColumn]: null });
    });
  }

  if (!hasMacro(builder, 'withTrashed')) {
    builder.macro('withTrashed', function (this: ModelQueryBuilderContract<ModelWithSoftDeletes>) {
      ensureModelWithSoftDeletes(this.model);

      return this.model.disableIgnore(this);
    });
  }

  if (!hasMacro(builder, 'onlyTrashed')) {
    builder.macro('onlyTrashed', function (this: ModelQueryBuilderContract<ModelWithSoftDeletes>) {
      ensureModelWithSoftDeletes(this.model);

      const deletedAtColumn = this.model.$getColumn('deletedAt')?.columnName ?? 'deleted_at';
      const query = this.model.disableIgnore(this) as ModelQueryBuilderContract<LucidModel>;

      void query.whereNotNull(`${this.model.table}.${deletedAtColumn}`);

      return query;
    });
  }
}
