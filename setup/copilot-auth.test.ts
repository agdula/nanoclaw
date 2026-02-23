import { describe, expect, it } from 'vitest';

import { upsertEnvValue } from './copilot-auth.js';

describe('upsertEnvValue', () => {
  it('adds key when file is empty', () => {
    expect(upsertEnvValue('', 'GH_TOKEN', 'abc')).toBe('GH_TOKEN=abc\n');
  });

  it('appends key when missing', () => {
    const content = 'ASSISTANT_NAME="Andy"\n';
    expect(upsertEnvValue(content, 'GH_TOKEN', 'abc'))
      .toBe('ASSISTANT_NAME="Andy"\nGH_TOKEN=abc\n');
  });

  it('replaces existing key', () => {
    const content = 'GH_TOKEN=old\nASSISTANT_NAME="Andy"\n';
    expect(upsertEnvValue(content, 'GH_TOKEN', 'new'))
      .toBe('GH_TOKEN=new\nASSISTANT_NAME="Andy"\n');
  });
});
