import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Whitelist, not discovery: SWC erases `import type`, so a module a test
      // only imports as a type never loads and would be missing from the report.
      // Mirrored by sonar.coverage.exclusions in sonar-project.properties.
      include: [
        'src/modules/audit/repositories/audit.repository.ts',
        'src/modules/auth/auth.service.ts',
        'src/modules/catalog/products.service.ts',
        'src/modules/inventory/movements.service.ts',
        'src/modules/inventory/repositories/stock.repository.ts',
        'src/modules/inventory/stock.service.ts',
        'src/modules/invitations/invitations.service.ts',
        'src/modules/reports/reports.service.ts',
        'src/modules/users/users.service.ts',
      ],
    },
  },
});
