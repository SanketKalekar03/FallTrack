const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mbawwfjfqzhkrptrgoar.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXd3ZmpmcXpoa3JwdHJnb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODE4ODgsImV4cCI6MjA5NzI1Nzg4OH0.UpaIXdOBwVpDTGYuatHBE00yh0Ka_RVy1uEIZRlCXC8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Inspecting triggers on production_entries via Supabase RPC/REST API...');
  
  // Try querying pg_catalog via raw SQL if possible, or try a test RPC
  // Supabase postgrest exposes tables that are in the 'public' schema.
  // We can try to query a system table if it is exposed, but usually pg_catalog is not exposed.
  // Let's see if we get an error or if we can read any triggers.
  const { data, error } = await supabase
    .from('production_entries')
    .select('id, entry_date, created_at, quantity')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log('Latest 30 records:');
  data.forEach((e, idx) => {
    console.log(`${idx + 1}. ID: ${e.id} | Date: ${e.entry_date} | Qty: ${e.quantity} | CreatedAt: ${e.created_at}`);
  });
}

run();
