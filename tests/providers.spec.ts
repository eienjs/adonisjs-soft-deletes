import type { ApplicationService } from '@adonisjs/core/types';
import { test } from '@japa/runner';

import LucidSoftDeletesProvider from '../providers/lucid_provider.js';

test.group('Lucid Provider', () => {
  test('lucid provider boots and extends query builder', async ({ assert }) => {
    let extendCalled = false;
    const fakeApp = {
      import: async () => {
        await Promise.resolve();

        return {
          ModelQueryBuilder: {
            hasMacro: () => false,
            macro: () => {
              extendCalled = true;
            },
          },
        };
      },
    } as unknown as ApplicationService;

    const lucidProvider = new LucidSoftDeletesProvider(fakeApp);
    await lucidProvider.boot();
    assert.isTrue(extendCalled);
  });
});
