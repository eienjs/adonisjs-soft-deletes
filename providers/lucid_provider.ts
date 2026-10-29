import type { ApplicationService } from '@adonisjs/core/types';
import { ModelQueryBuilder } from '@adonisjs/lucid/orm';

/**
 * AdonisJS Service Provider for Lucid Soft Deletes
 */
export default class LucidSoftDeletesProvider {
  protected app: ApplicationService;

  public constructor(app: ApplicationService) {
    this.app = app;
  }

  public async boot(): Promise<void> {
    const { extendModelQueryBuilder } = await import('../src/lucid/bindings/model_query_builder.js');
    extendModelQueryBuilder(ModelQueryBuilder);
  }
}

declare module '@adonisjs/lucid/orm' {
  interface ModelQueryBuilder {
    ignoreDeleted?: boolean;
    onlyTrashed: () => this;
    restore: () => Promise<unknown>;
    withTrashed: () => this;
  }
}

declare module '@adonisjs/lucid/types/model' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ModelQueryBuilderContract<Model extends LucidModel, Result = InstanceType<Model>> {
    ignoreDeleted?: boolean;
    onlyTrashed: () => this;
    restore: () => Promise<unknown>;
    withTrashed: () => this;
  }
}
