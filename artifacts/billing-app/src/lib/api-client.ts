export const api = {
  get: async (url: string, config?: { params?: Record<string, any> }) => {
    let fullUrl = url;
    if (config?.params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(config.params)) {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      }
      const qs = searchParams.toString();
      if (qs) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
    }
    const res = await fetch(fullUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw { response: { data: err }, message: err.error || res.statusText };
    }
    return { data: await res.json() };
  },
  post: async (url: string, data?: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw { response: { data: err }, message: err.error || res.statusText };
    }
    return { data: await res.json() };
  },
  patch: async (url: string, data?: any) => {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw { response: { data: err }, message: err.error || res.statusText };
    }
    return { data: await res.json() };
  },
  delete: async (url: string) => {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw { response: { data: err }, message: err.error || res.statusText };
    }
    return { data: null };
  },
};

export default api;
