const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mbawwfjfqzhkrptrgoar.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXd3ZmpmcXpoa3JwdHJnb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODE4ODgsImV4cCI6MjA5NzI1Nzg4OH0.UpaIXdOBwVpDTGYuatHBE00yh0Ka_RVy1uEIZRlCXC8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching production entries from Supabase...');
  const { data, error } = await supabase
    .from('production_entries')
    .select('*, color:colors(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching entries:', error);
    return;
  }

  console.log(`Total entries found: ${data.length}\n`);
  data.forEach((e, idx) => {
    console.log(`${idx + 1}. ID: ${e.id} | Date: ${e.entry_date} | Color: ${e.color?.name || 'Unspecified'} | Qty: ${e.quantity} | CreatedAt: ${e.created_at}`);
  });
}

run();
