import { describe, it, expect } from 'vitest';
import { buildPrompt } from './prompt.js';

describe('buildPrompt', () => {
  it('correctly builds system and user prompts', () => {
    const userInput = 'Generate a workflow that fetches user details and waits 5 seconds';
    const result = buildPrompt(userInput);

    expect(result.system).toContain('WorkflowDefinition');
    expect(result.system).toContain('DO NOT generate SCRIPT type steps');
    expect(result.user).toBe(`<<<USER_REQUEST>>>\n${userInput}\n<<<END_USER_REQUEST>>>`);
  });
});
