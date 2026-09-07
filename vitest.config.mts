import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Los servicios se construyen a mano en los tests, pero siguen llevando
  // decoradores de Nest en el codigo fuente.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
