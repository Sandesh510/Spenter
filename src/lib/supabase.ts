// The browser never talks to Supabase with the service key. Data access goes through
// Netlify Functions (netlify/functions/), which read SUPABASE_URL and SUPABASE_SERVICE_KEY
// on the server. Do not add a Supabase client here that uses the service key.
export {};
