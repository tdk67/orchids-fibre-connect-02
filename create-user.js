import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://srv1102882.hstgr.cloud:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'Test123456',
      email_confirm: true
    });

    if (error) {
      console.error('Error creating user:', error);
      return;
    }

    console.log('User created successfully:', data);
  } catch (err) {
    console.error('Exception:', err);
  }
}

createUser();
