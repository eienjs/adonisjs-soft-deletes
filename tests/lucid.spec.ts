import { compose } from '@adonisjs/core/helpers';
import { BaseModel, ModelQueryBuilder } from '@adonisjs/lucid/orm';
import { test } from '@japa/runner';
import { DateTime } from 'luxon';
import { extendModelQueryBuilder } from '../src/lucid/bindings/model_query_builder.js';
import { SoftDeletes } from '../src/lucid/mixin.js';

test.group('Lucid SoftDeletes Mixin', () => {
  test('model has default soft delete properties', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {}

    const user = new User();
    assert.isFalse(user.$forceDelete);
    assert.isUndefined(user.deletedAt);
    assert.isFalse(user.$trashed);
  });

  test('$trashed returns true when deletedAt is set', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {}

    const user = new User();
    user.deletedAt = DateTime.now();
    assert.isTrue(user.$trashed);
  });

  test('restore() resets deletedAt to null on trashed model', async ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {
      public override async save(): Promise<this> {
        await Promise.resolve();

        return this;
      }
    }

    const user = new User();
    user.deletedAt = DateTime.now();
    assert.isTrue(user.$trashed);

    await user.restore();
    assert.isNull(user.deletedAt);
    assert.isFalse(user.$trashed);
  });

  test('restore() returns immediately when not trashed', async ({ assert }) => {
    let saveCalled = false;
    class User extends compose(BaseModel, SoftDeletes) {
      public override async save(): Promise<this> {
        await Promise.resolve();
        saveCalled = true;

        return this;
      }
    }

    const user = new User();
    await user.restore();
    assert.isFalse(saveCalled);
  });

  test('restore() throws error when model was force deleted', async ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {}

    const user = new User();
    user.$isDeleted = true;

    await assert.rejects(async () => {
      await user.restore();
    }, 'Cannot restore a model instance that was force deleted');
  });

  test('forceDelete() sets $forceDelete to true and deletes model', async ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {}

    User.$adapter = {
      delete: async () => {
        await Promise.resolve();

        return [1];
      },
    } as any;

    const user = new User();
    assert.isFalse(user.$forceDelete);

    await user.forceDelete();
    assert.isTrue(user.$forceDelete);
    assert.isTrue(user.$isDeleted);
  });

  test('disableIgnore sets ignoreDeleted to false', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {}

    const fakeQuery = { ignoreDeleted: true };
    const result = User.disableIgnore(fakeQuery) as { ignoreDeleted: boolean };
    assert.isFalse(result.ignoreDeleted);
  });
});

test.group('Lucid ModelQueryBuilder extensions', () => {
  test('registers restore, withTrashed and onlyTrashed macros on real ModelQueryBuilder', ({ assert }) => {
    extendModelQueryBuilder(ModelQueryBuilder);

    assert.isFunction(ModelQueryBuilder.prototype.restore);
    assert.isFunction(ModelQueryBuilder.prototype.withTrashed);
    assert.isFunction(ModelQueryBuilder.prototype.onlyTrashed);
  });

  test('query builder withTrashed disables ignoreDeleted', ({ assert }) => {
    extendModelQueryBuilder(ModelQueryBuilder);

    class User extends compose(BaseModel, SoftDeletes) {}

    const fakeQuery = {
      ignoreDeleted: true,
      model: User,
    };

    const withTrashedFn = ModelQueryBuilder.prototype.withTrashed;
    const result = withTrashedFn.call(fakeQuery);

    assert.isFalse(result.ignoreDeleted);
  });

  test('query builder onlyTrashed adds whereNotNull condition', ({ assert }) => {
    extendModelQueryBuilder(ModelQueryBuilder);

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }

    let whereNotNullColumn: string | undefined;
    const fakeQuery = {
      ignoreDeleted: true,
      model: User,
      whereNotNull: (col: string) => {
        whereNotNullColumn = col;

        return fakeQuery;
      },
    };

    const onlyTrashedFn = ModelQueryBuilder.prototype.onlyTrashed;
    const result = onlyTrashedFn.call(fakeQuery);

    assert.isFalse(result.ignoreDeleted);
    assert.equal(whereNotNullColumn, 'users.deleted_at');
  });

  test('query builder restore executes update with null', async ({ assert }) => {
    extendModelQueryBuilder(ModelQueryBuilder);

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }

    let updatedPayload: Record<string, unknown> | undefined;
    const fakeQuery = {
      model: User,
      update: async (payload: Record<string, unknown>) => {
        await Promise.resolve();
        updatedPayload = payload;

        return 1;
      },
    };

    const restoreFn = ModelQueryBuilder.prototype.restore;
    const rows = await restoreFn.call(fakeQuery);

    assert.equal(rows, 1);
    assert.deepEqual(updatedPayload, { deleted_at: null });
  });

  test('macros throw exception when model does not support soft deletes', ({ assert }) => {
    extendModelQueryBuilder(ModelQueryBuilder);

    class PlainModel {}

    const context = {
      model: PlainModel,
    };

    assert.throws(() => {
      ModelQueryBuilder.prototype.withTrashed.call(context);
    }, 'PlainModel model does not support Soft Deletes');

    assert.throws(() => {
      ModelQueryBuilder.prototype.onlyTrashed.call(context);
    }, 'PlainModel model does not support Soft Deletes');
  });

  test('static withTrashed and onlyTrashed on Model return query', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }

    let whereNotNullColumn: string | undefined;
    const mockQuery = {
      clone: () => mockQuery,
      ignoreDeleted: true,
      model: User,
      toQuery: () => 'select *',
      whereNotNull: (col: string) => {
        whereNotNullColumn = col;

        return mockQuery;
      },
    };

    User.query = (() => mockQuery) as any;

    const withTrashedResult = User.withTrashed() as { ignoreDeleted: boolean };
    assert.isFalse(withTrashedResult.ignoreDeleted);

    const onlyTrashedResult = User.onlyTrashed() as { ignoreDeleted: boolean };
    assert.isFalse(onlyTrashedResult.ignoreDeleted);
    assert.equal(whereNotNullColumn, 'users.deleted_at');
  });
});
