#!/usr/bin/env node
const { execSync } = require('child_process');

const vars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://tqvmiggqjzgjrmkzkbcp.supabase.co', env: 'production' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: 'sb_publishable_O_UoFHE5rB2kkFmeFKgaKQ_FidnsQ-U', env: 'production' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: 'sb_secret_N8QU7FMYfa_ZaqH6dhdFPQ_M9wrhqaL', env: 'production' }
];

vars.forEach(({ name, value, env }) => {
  try {
    console.log(`Adding ${name} to ${env}...`);
    execSync(`vercel env add ${name} ${env}`, {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf-8'
    });
    console.log(`✅ ${name} added`);
  } catch (error) {
    console.error(`❌ Error adding ${name}:`, error.message);
  }
});

console.log('\n🎉 Done! Now run: vercel deploy --prod');
