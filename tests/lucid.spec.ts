import type { QueryClientContract } from '@adonisjs/lucid/types/database';
import { compose } from '@adonisjs/core/helpers';
import { BaseModel, ModelQueryBuilder } from '@adonisjs/lucid/orm';
import { test } from '@japa/runner';
import knex from 'knex';
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

  test('ignoreDeleted adds whereNull condition on default query', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }

    let whereNullColumn: string | undefined;
    const defaultQuery = {
      clone: () => defaultQuery,
      model: User,
      toQuery: () => 'select * from users',
      whereNull: (col: string) => {
        whereNullColumn = col;

        return defaultQuery;
      },
    };

    User.ignoreDeleted(defaultQuery);
    assert.equal(whereNullColumn, 'users.deleted_at');
  });

  test('ignoreDeleted skips whereNull when ignoreDeleted is false', ({ assert }) => {
    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }

    let whereNullCalled = false;
    const query = {
      clone: () => query,
      ignoreDeleted: false,
      model: User,
      toQuery: () => 'select * from users',
      whereNull: () => {
        whereNullCalled = true;

        return query;
      },
    };

    User.ignoreDeleted(query);
    assert.isFalse(whereNullCalled);
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

test.group('Lucid SoftDeletes SQL query generation and filtering', (group) => {
  const fakeClient = { debug: false } as unknown as QueryClientContract;

  group.setup(() => {
    extendModelQueryBuilder(ModelQueryBuilder);
  });

  test('default query compiles to SQL with where deleted_at is null', ({ assert }) => {
    const k = knex({ client: 'sqlite3', useNullAsDefault: true });

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }
    User.boot();

    const builder = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    User.ignoreDeleted(builder);

    assert.equal(builder.toQuery(), 'select * from `users` where `users`.`deleted_at` is null');
  });

  test('withTrashed query compiles to SQL without where deleted_at is null', ({ assert }) => {
    const k = knex({ client: 'sqlite3', useNullAsDefault: true });

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }
    User.boot();

    const builder = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    builder.withTrashed();
    User.ignoreDeleted(builder);

    assert.equal(builder.toQuery(), 'select * from `users`');
  });

  test('onlyTrashed query compiles to SQL with where deleted_at is not null', ({ assert }) => {
    const k = knex({ client: 'sqlite3', useNullAsDefault: true });

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }
    User.boot();

    const builder = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    builder.onlyTrashed();
    User.ignoreDeleted(builder);

    assert.equal(builder.toQuery(), 'select * from `users` where `users`.`deleted_at` is not null');
  });

  test('scenario: two active records and one soft deleted record', ({ assert }) => {
    const k = knex({ client: 'sqlite3', useNullAsDefault: true });

    class User extends compose(BaseModel, SoftDeletes) {
      public static override table = 'users';
    }
    User.boot();

    const mockRecords = [
      { deleted_at: null, id: 1, name: 'Alice' },
      { deleted_at: null, id: 2, name: 'Bob' },
      { deleted_at: '2026-10-29 19:00:00', id: 3, name: 'Charlie' },
    ];

    const executeQuery = (builder: ModelQueryBuilder) => {
      User.ignoreDeleted(builder);
      const sql = builder.toQuery();

      return mockRecords.filter((record) => {
        if (sql.includes('`users`.`deleted_at` is null') && record.deleted_at !== null) {
          return false;
        }
        if (sql.includes('`users`.`deleted_at` is not null') && record.deleted_at === null) {
          return false;
        }

        return true;
      });
    };

    // 1. Default query (only non-deleted records)
    const defaultQuery = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    const defaultResults = executeQuery(defaultQuery);
    assert.lengthOf(defaultResults, 2);
    assert.deepEqual(
      defaultResults.map((u) => u.name),
      ['Alice', 'Bob'],
    );

    // 2. withTrashed (all records including trashed)
    const withTrashedQuery = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    withTrashedQuery.withTrashed();
    const withTrashedResults = executeQuery(withTrashedQuery);
    assert.lengthOf(withTrashedResults, 3);
    assert.deepEqual(
      withTrashedResults.map((u) => u.name),
      ['Alice', 'Bob', 'Charlie'],
    );

    // 3. onlyTrashed (only soft-deleted records)
    const onlyTrashedQuery = new ModelQueryBuilder(k.from('users'), User, fakeClient);
    onlyTrashedQuery.onlyTrashed();
    const onlyTrashedResults = executeQuery(onlyTrashedQuery);
    assert.lengthOf(onlyTrashedResults, 1);
    assert.deepEqual(
      onlyTrashedResults.map((u) => u.name),
      ['Charlie'],
    );
  });
});
