const required = ['DATABASE_URL'];

const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
