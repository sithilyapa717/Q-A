const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const hostPassword = process.env.HOST_PASSWORD || '';
const publicBaseUrl =
  process.env.PUBLIC_BASE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  '';

const contents = `window.DIAGNOSE_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  HOST_PASSWORD: ${JSON.stringify(hostPassword)},
  PUBLIC_BASE_URL: ${JSON.stringify(publicBaseUrl)}
};
`;

const outPath = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(outPath, contents, 'utf8');

if (!url || !key) {
  console.warn(
    'Warning: SUPABASE_URL and/or SUPABASE_ANON_KEY are not set. ' +
      'Copy js/config.example.js to js/config.js for local development.'
  );
} else {
  console.log('Generated js/config.js from environment variables.');
}

if (!hostPassword) {
  console.warn('Warning: HOST_PASSWORD is not set. Host room creation will be blocked.');
}
