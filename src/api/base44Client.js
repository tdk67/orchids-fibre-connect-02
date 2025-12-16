import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast in dev; in production this will surface clearly
  console.warn('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
}

// Default client (anon, persisted session)
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Optional service-role client for elevated operations (no session persistence)
const serviceSupabase = supabaseServiceKey
  ? createClient(supabaseUrl || '', supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase;

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
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw error || new Error('Not authenticated');
      const profile = await fetchProfile(data.user.id);
      return mapProfileFromUser(data.user, profile);
    },

    async login({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await fetchProfile(data.user?.id);
      return mapProfileFromUser(data.user, profile);
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