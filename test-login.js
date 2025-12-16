import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://srv1102882.hstgr.cloud:8000',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

async function testLogin() {
  try {
    console.log('Testing login...');
    const result = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'Test123456'
    });
    console.log('Login result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Login error:', error);
  }
}

testLogin();
