import { describe, expect, it, vi } from 'vitest';

import { reportBootstrapFailure } from './main';

describe('bootstrap monitoring boundary', () => {
  it('captures an eligible consumed rejection once and preserves console fallback', () => {
    const captureException = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('bootstrap failed');
    reportBootstrapFailure(error, { captureException });
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
