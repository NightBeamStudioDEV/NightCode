const { execFileSync } = require('child_process');
const fs = require('fs');
const names = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
const blocked = /(^|\/)(node_modules|release|dist|dist-electron|test-results|runtime|\.venv)(\/|$)|\.(sqlite|db|pem|key|pfx|p12)$|(^|\/)\.env($|\.)/i;
const secret = /(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const findings = [];
for (const name of names) {
  if (blocked.test(name)) findings.push(name + ': private/generated path');
  const bytes = fs.readFileSync(name);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  if (secret.test(text)) findings.push(name + ': possible credential');
  if (/(?:C:[\\/]Users[\\/](?!Public)|E:[\\/]Projects[\\/]NightCode)/i.test(text)) findings.push(name + ': personal path');
}
if (findings.length) { console.error(findings.join('\n')); process.exit(1); }
console.log(`Checked ${names.length} public files: no matching credentials, private paths, or generated directories.`);
