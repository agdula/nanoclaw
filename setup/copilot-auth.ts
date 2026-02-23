/**
 * Step: copilot-auth — acquire a GitHub token via Device Flow and persist to .env.
 *
 * This is useful when users run NanoClaw via GitHub Copilot-linked access and
 * don't already have a token in .env.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// GitHub CLI public OAuth app client_id (device flow).
// Can be overridden via --client-id or GITHUB_OAUTH_CLIENT_ID.
const DEFAULT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

function parseArgs(args: string[]): { clientId: string; scope: string; envKey: string } {
  let clientId = process.env.GITHUB_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
  let scope = 'read:user';
  let envKey = 'GH_TOKEN';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--client-id':
        clientId = args[++i] || clientId;
        break;
      case '--scope':
        scope = args[++i] || scope;
        break;
      case '--env-key':
        envKey = args[++i] || envKey;
        break;
    }
  }

  return { clientId, scope, envKey };
}

async function requestDeviceCode(clientId: string, scope: string): Promise<DeviceCodeResponse> {
  const resp = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ client_id: clientId, scope }),
  });

  if (!resp.ok) {
    throw new Error(`Device code request failed (${resp.status})`);
  }

  return resp.json() as Promise<DeviceCodeResponse>;
}

async function pollAccessToken(
  clientId: string,
  deviceCode: string,
  intervalSec: number,
  expiresInSec: number,
): Promise<AccessTokenResponse> {
  const startedAt = Date.now();
  let pollIntervalMs = Math.max(1, intervalSec) * 1000;

  while ((Date.now() - startedAt) / 1000 < expiresInSec) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const resp = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!resp.ok) {
      throw new Error(`Access token request failed (${resp.status})`);
    }

    const data = (await resp.json()) as AccessTokenResponse;
    if (data.access_token) return data;

    if (data.error === 'authorization_pending') {
      continue;
    }
    if (data.error === 'slow_down') {
      pollIntervalMs += 5000;
      continue;
    }

    return data;
  }

  return { error: 'expired_token', error_description: 'Device flow timed out' };
}

export function upsertEnvValue(currentContent: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const keyRegex = new RegExp(`^${key}=.*$`, 'm');

  if (keyRegex.test(currentContent)) {
    return currentContent.replace(keyRegex, line);
  }

  const suffix = currentContent.endsWith('\n') || currentContent.length === 0 ? '' : '\n';
  return `${currentContent}${suffix}${line}\n`;
}

export async function run(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, '.env');
  const { clientId, scope, envKey } = parseArgs(args);

  logger.info({ envKey, scope }, 'Starting GitHub device auth flow');

  const device = await requestDeviceCode(clientId, scope);

  console.log('\n=== GitHub Device Login ===');
  console.log('1) Open: https://github.com/login/device');
  console.log(`2) Enter code: ${device.user_code}`);
  console.log('3) Authorize access, then come back here.\n');

  const rl = readline.createInterface({ input, output });
  await rl.question('Naciśnij Enter po autoryzacji... ');
  rl.close();

  const tokenResp = await pollAccessToken(
    clientId,
    device.device_code,
    device.interval,
    device.expires_in,
  );

  if (!tokenResp.access_token) {
    const errorText = tokenResp.error_description || tokenResp.error || 'unknown_error';
    emitStatus('COPILOT_AUTH', {
      STATUS: 'failed',
      ERROR: errorText,
      LOG: 'logs/setup.log',
    });
    throw new Error(`GitHub device flow failed: ${errorText}`);
  }

  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  const updated = upsertEnvValue(existing, envKey, tokenResp.access_token);
  fs.writeFileSync(envPath, updated);

  emitStatus('COPILOT_AUTH', {
    STATUS: 'success',
    ENV_KEY: envKey,
    LOG: 'logs/setup.log',
  });

  logger.info({ envKey }, 'Stored GitHub token in .env');
}
