# @eienjs/adonisjs-soft-deletes

[![Source Code][badge-source]][source]
[![Npm Node Version Support][badge-node-version]][node-version]
[![Latest Version][badge-release]][release]
[![Software License][badge-license]][license]
[![Build Status][badge-build]][build]
[![Total Downloads][badge-downloads]][downloads]

> Provider-based Soft deletes for AdonisJS with full Lucid ORM support.

## Features

- **Full Lucid ORM Integration**: Automatic query filtering (`deleted_at is null`), eager relationship filtering, and `ModelQueryBuilder` macros.
- **Fluent Querying**: `User.query().withTrashed()`, `User.query().onlyTrashed()`, `User.query().restore()`, plus static helpers `User.withTrashed()` and `User.onlyTrashed()`.
- **Instance Helpers**: `.$trashed` boolean getter, `.delete()` (soft delete), `.restore()`, and `.forceDelete()`.

---

## Quick Start

Install the package using the following command:

```bash
node ace add @eienjs/adonisjs-soft-deletes
```

This will register the Lucid provider in your `adonisrc.ts` file:

```ts
export default defineConfig({
  providers: [
    () => import('@eienjs/adonisjs-soft-deletes/providers/lucid_provider'),
  ],
});
```

### Usage

#### 1. Database Migration

Ensure your database table includes a nullable `deleted_at` timestamp:

```ts
import { BaseSchema } from '@adonisjs/lucid/schema';

export default class UsersTable extends BaseSchema {
  protected tableName = 'users';

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id');
      table.string('email').notNullable();
      table.timestamp('deleted_at').nullable();
      table.timestamp('created_at').notNullable();
      table.timestamp('updated_at').nullable();
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
```

#### 2. Model Definition

Apply the `SoftDeletes` mixin to your Lucid model:

```ts
import { compose } from '@adonisjs/core/helpers';
import { BaseModel } from '@adonisjs/lucid/orm';
import { SoftDeletes } from '@eienjs/adonisjs-soft-deletes/lucid/mixin';

export default class User extends compose(BaseModel, SoftDeletes) {
  // Model properties and columns...
}
```

#### 3. Soft Deleting and Restoring Records

```ts
// Find a record and soft delete
const user = await User.findOrFail(1);
await user.delete(); // Sets deleted_at to current timestamp

console.log(user.$trashed); // true

// Restore soft-deleted record
await user.restore();
console.log(user.$trashed); // false

// Permanently delete from database
await user.forceDelete();
```

#### 4. Querying Records

By default, queries automatically exclude soft-deleted records:

```ts
// Excludes soft-deleted records automatically
const activeUsers = await User.all();

// Include soft-deleted records via query builder
const allUsers = await User.query().withTrashed();

// Retrieve only soft-deleted records via query builder
const archivedUsers = await User.query().onlyTrashed();

// Bulk restore soft-deleted records via query builder
await User.query().onlyTrashed().where('status', 'inactive').restore();

// Static helpers on model
const all = await User.withTrashed();
const archived = await User.onlyTrashed();
```

## Documentation

The documentation is available on [EienJS](https://eienjs.com/packages/adonisjs-soft-deletes/).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING][] for more details and remember to check the [CHANGELOG][] file.

## Copyright and License

The `@eienjs/adonisjs-soft-deletes` library is licensed for use under the MIT License (MIT). Please see [LICENSE][] for more information.

[contributing]: https://github.com/eienjs/.github/blob/main/docs/CONTRIBUTING.md
[changelog]: https://github.com/eienjs/adonisjs-soft-deletes/blob/main/CHANGELOG.md
[source]: https://github.com/eienjs/adonisjs-soft-deletes
[node-version]: https://www.npmjs.com/package/@eienjs/adonisjs-soft-deletes
[release]: https://www.npmjs.com/package/@eienjs/adonisjs-soft-deletes
[license]: https://github.com/eienjs/adonisjs-soft-deletes/blob/main/LICENSE.md
[build]: https://github.com/eienjs/adonisjs-soft-deletes/actions/workflows/build.yml?query=branch:main
[downloads]: https://www.npmjs.com/package/@eienjs/adonisjs-soft-deletes
[badge-source]: https://img.shields.io/badge/source-eienjs/adonisjs--soft--deletes-blue.svg?logo=github
[badge-node-version]: https://img.shields.io/node/v/@eienjs/adonisjs-soft-deletes.svg?logo=nodedotjs
[badge-release]: https://img.shields.io/npm/v/@eienjs/adonisjs-soft-deletes.svg?logo=npm
[badge-license]: https://img.shields.io/github/license/eienjs/adonisjs-soft-deletes?logo=open-source-initiative
[badge-build]: https://img.shields.io/github/actions/workflow/status/eienjs/adonisjs-soft-deletes/build.yml?branch=main
[badge-downloads]: https://img.shields.io/npm/dm/@eienjs/adonisjs-soft-deletes.svg?logo=npm
