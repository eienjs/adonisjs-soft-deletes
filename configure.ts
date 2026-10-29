import type ConfigureCommand from '@adonisjs/core/commands/configure';

/**
 * Configure hook executed via `node ace configure @eienjs/adonisjs-soft-deletes`
 */
export async function configure(command: ConfigureCommand): Promise<void> {
  const codemods = await command.createCodemods();

  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@eienjs/adonisjs-soft-deletes/providers/lucid_provider');
  });
}
