const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mbawwfjfqzhkrptrgoar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXd3ZmpmcXpoa3JwdHJnb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODE4ODgsImV4cCI6MjA5NzI1Nzg4OH0.UpaIXdOBwVpDTGYuatHBE00yh0Ka_RVy1uEIZRlCXC8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Connecting to Supabase...');
  try {
    const { data: entries, error } = await supabase
      .from('production_entries')
      .select('*, color:colors(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      return;
    }

    console.log(`Total production entries: ${entries.length}`);
    console.log('All Production Entries in Supabase (sorted by creation time):');
    entries.forEach(e => {
      console.log(`- ID: ${e.id}, Date: ${e.entry_date}, Color: ${e.color ? e.color.name : 'Unknown'}, Qty: ${e.quantity}, Created At: ${e.created_at}`);
    });
  } catch (err) {
    console.error('Execution error:', err);
  }
}

main();
