// build.js — exécuté par Vercel avant le déploiement
const fs = require('fs');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('⚠️  SUPABASE_URL ou SUPABASE_ANON_KEY manquants dans les variables Vercel !');
}

const content = `// Généré automatiquement par build.js
window.ENV = {
  SUPABASE_URL:      '${url}',
  SUPABASE_ANON_KEY: '${key}',
};
`;

fs.writeFileSync('./public/env.js', content);
console.log('✅ public/env.js généré');
