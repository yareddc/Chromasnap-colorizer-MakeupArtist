import { execSync } from 'child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });

try {
  run('git config core.hooksPath .githooks');
  console.log('Git hooks path set to .githooks');
  console.log('Pre-commit secret scanning is now enabled.');
} catch (error) {
  console.error('Failed to configure git hooks path. Ensure this is a git repository.');
  process.exit(1);
}
