const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false, storagePrefix = 'supabase' } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `${storagePrefix}_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	return {
		supabaseUrl: getAppParamValue("supabase_url", { defaultValue: import.meta.env.VITE_SUPABASE_URL }),
		supabaseAnonKey: getAppParamValue("supabase_anon_key", { defaultValue: import.meta.env.VITE_SUPABASE_ANON_KEY }),
		supabaseServiceRoleKey: getAppParamValue("supabase_service_role_key", { defaultValue: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY }),
		fromUrl: getAppParamValue("from_url", { defaultValue: typeof window !== 'undefined' ? window.location.href : undefined }),
	}
}

export const appParams = {
	...getAppParams()
}