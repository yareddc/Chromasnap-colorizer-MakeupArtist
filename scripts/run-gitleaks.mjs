import { spawnSync } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);

const windowsFallback = path.join(
  process.env.LOCALAPPDATA || '',
  'Microsoft',
  'WinGet',
  'Packages',
  'Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'gitleaks.exe',
);

const commands = process.platform === 'win32'
  ? ['gitleaks.exe', 'gitleaks', windowsFallback]
  : ['gitleaks'];

const tryRun = (command) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    return { ok: false, code: null };
  }

  return { ok: true, code: result.status ?? 0 };
};

let executed = false;
let exitCode = 1;

for (const command of commands) {
  const { ok, code } = tryRun(command);
  if (!ok) continue;
  executed = true;
  exitCode = code;
  break;
}

if (!executed) {
  console.error('gitleaks executable not found.');
  console.error('Install with: winget install --id Gitleaks.Gitleaks');
  process.exit(1);
}

process.exit(exitCode);
