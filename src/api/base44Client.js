import { createClient } from '@supabase/supabase-js';

// Helper to ensure we never send data over insecure HTTP in production
const getSafeSupabaseUrl = (url) => {
  if (!url) return '';
  
  // If the site is running on HTTPS (like Vercel), but the URL is HTTP, upgrade it
  // This prevents "Mixed Content" errors and ensures password encryption via TLS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    console.warn('Insecure Supabase URL detected on HTTPS site. Upgrading to HTTPS to prevent Mixed Content error.');
    return url.replace('http://', 'https://').replace(':8000', ''); // Remove :8000 which is usually for local/HTTP
  }
  return url;
};

const supabaseUrl = getSafeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast in dev; in production this will surface clearly
  console.warn('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
}

// Default client (anon, persisted session)
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Use the standard client for everything on the frontend
const serviceSupabase = supabase;

const parseOrder = (orderBy) => {
  if (!orderBy) return null;
  const isDesc = orderBy.startsWith('-');
  const column = isDesc ? orderBy.slice(1) : orderBy;
  return { column, ascending: !isDesc };
};

const withOrdering = (query, orderBy) => {
  const order = parseOrder(orderBy);
  if (!order) return query;
  return query.order(order.column, { ascending: order.ascending });
};

const handle = async (promise) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

const createEntityClient = (tableName) => ({
  async list(orderBy, limit = 1000) {
    let query = supabase.from(tableName).select('*');
    query = withOrdering(query, orderBy);
    if (limit) query = query.limit(limit);
    return handle(query);
  },

  async filter(filters = {}, orderBy, limit = 1000) {
    let query = supabase.from(tableName).select('*');
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      query = query.eq(key, value);
    });
    query = withOrdering(query, orderBy);
    if (limit) query = query.limit(limit);
    return handle(query);
  },

  async create(data) {
    return handle(supabase.from(tableName).insert(data).select().single());
  },

  async bulkCreate(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];
    return handle(supabase.from(tableName).insert(items).select());
  },

  async update(id, data) {
    return handle(supabase.from(tableName).update(data).eq('id', id).select().single());
  },

  async delete(id) {
    await handle(supabase.from(tableName).delete().eq('id', id));
    return true;
  }
});

const mapProfileFromUser = (user, profile) => {
  const meta = user?.user_metadata || {};
  return {
    id: user?.id,
    email: user?.email,
    full_name: meta.full_name || profile?.full_name || user?.email,
    role: meta.role || profile?.role || 'user',
    rolle: meta.rolle || profile?.rolle || meta.role || profile?.role || 'Mitarbeiter',
    benutzertyp: meta.benutzertyp || profile?.benutzertyp || 'Interner Mitarbeiter',
    ...profile,
  };
};

const fetchProfile = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .or(`user_id.eq.${userId},auth_user_id.eq.${userId}`)
    .maybeSingle();
  if (error) return null;
  return data;
};

export const base44 = {
  client: supabase,
  serviceClient: serviceSupabase,

  auth: {
    async me() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const sessionUser = sessionData?.session?.user;
      if (!sessionUser) throw new Error('Not authenticated');
      const profile = await fetchProfile(sessionUser.id);
      return mapProfileFromUser(sessionUser, profile);
    },

    async login({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const sessionUser = data?.user ?? data?.session?.user;
      const profile = await fetchProfile(sessionUser?.id);
      return mapProfileFromUser(sessionUser, profile);
    },

    async logout(redirectUrl) {
      await supabase.auth.signOut();
      if (redirectUrl && typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    },

    redirectToLogin(redirectUrl) {
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl || '/login';
      }
    }
  },

  entities: {
    Query: createEntityClient('queries'),
    Bestandskunde: createEntityClient('bestandskunden'),
    Sale: createEntityClient('sales'),
    Employee: createEntityClient('employees'),
    Lead: createEntityClient('leads'),
    Termin: createEntityClient('termine'),
    LeadStatus: createEntityClient('lead_status'),
    Provisionsregel: createEntityClient('provisionsregeln'),
    CreditNote: createEntityClient('credit_notes'),
    Customer: createEntityClient('customers'),
    ChatMessage: createEntityClient('chat_messages'),
    Angebot: createEntityClient('angebote'),
  },

  functions: {
    async invoke(name, payload = {}) {
      const { data, error } = await serviceSupabase.functions.invoke(name, { body: payload });
      if (error) throw error;
      return { data };
    }
  },

  appLogs: {
    async logUserInApp(pageName) {
      if (!pageName) return;
      try {
        await serviceSupabase.from('app_logs').insert({ page: pageName, visited_at: new Date().toISOString() });
      } catch (err) {
        console.warn('appLogs insert failed', err?.message || err);
      }
    }
  },

  integrations: {
    Core: {
      async InvokeLLM(args) {
        const { data, error } = await serviceSupabase.functions.invoke('invoke-llm', { body: args });
        if (error) throw error;
        return data;
      },
      async SendEmail(args) {
        const { data, error } = await serviceSupabase.functions.invoke('send-email', { body: args });
        if (error) throw error;
        return data;
      },
      async SendSMS(args) {
        const { data, error } = await serviceSupabase.functions.invoke('send-sms', { body: args });
        if (error) throw error;
        return data;
      },
      async UploadFile(args) {
        const { data, error } = await serviceSupabase.functions.invoke('upload-file', { body: args });
        if (error) throw error;
        return data;
      },
      async GenerateImage(args) {
        const { data, error } = await serviceSupabase.functions.invoke('generate-image', { body: args });
        if (error) throw error;
        return data;
      },
      async ExtractDataFromUploadedFile(args) {
        const { data, error } = await serviceSupabase.functions.invoke('extract-data', { body: args });
        if (error) throw error;
        return data;
      },
    }
  },
};