const { existsSync } = require('node:fs');
const { join, delimiter } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const androidDir = join(root, 'android');
const localJdk = join(root, '.tools', 'jdk21', 'jdk-21.0.11+10');
const localSdk = join(root, '.tools', 'android-sdk');

const env = { ...process.env };

if (existsSync(localJdk)) {
  env.JAVA_HOME = localJdk;
  env.Path = `${join(localJdk, 'bin')}${delimiter}${env.Path || ''}`;
}

if (existsSync(localSdk)) {
  env.ANDROID_HOME = localSdk;
  env.ANDROID_SDK_ROOT = localSdk;
  env.Path = `${join(localSdk, 'platform-tools')}${delimiter}${env.Path || ''}`;
}

function run(command, args, options = {}) {
  const cwd = options.cwd || root;

  if (process.platform === 'win32') {
    const commandLine = [command, ...args].map((arg) => `"${arg}"`).join(' ');
    const result = spawnSync(commandLine, {
      cwd,
      env,
      stdio: 'inherit',
      shell: true,
    });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }

    return;
  }

  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const capCommand = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'cap.cmd' : 'cap',
);
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

run('node', [join(root, 'scripts', 'android-apply-branding.js')]);
run(capCommand, ['sync', 'android']);
run(gradleCommand, ['assembleRelease'], { cwd: androidDir });
