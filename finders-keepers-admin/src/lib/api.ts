import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (original.headers) original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== 'undefined') {
          localStorage.clear();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${API_URL}/auth/admin/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } },
        );
        const newAccess = data.tokens?.accessToken || data.accessToken;
        const newRefresh = data.tokens?.refreshToken || data.refreshToken;

        localStorage.setItem('accessToken', newAccess);
        if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);

        if (original.headers) original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── API helpers ──────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/admin/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/admin/logout').then((r) => r.data),
  me: () => api.get('/auth/admin/me').then((r) => r.data),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats').then((r) => r.data),
};

export const categoriesApi = {
  findAll: () => api.get('/categories').then((r) => r.data),
  findTree: () => api.get('/categories/tree').then((r) => r.data),
  findOne: (id: string) => api.get(`/categories/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/categories', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/categories/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const productsApi = {
  findAll: (params?: Record<string, unknown>) => api.get('/products', { params }).then((r) => r.data),
  findOne: (id: string) => api.get(`/products/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/products', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/products/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
  addImage: (id: string, fileId: string) => api.post(`/products/${id}/images/${fileId}`).then((r) => r.data),
  setPrimaryImage: (id: string, imageId: string) => api.patch(`/products/${id}/images/${imageId}/primary`).then((r) => r.data),
  removeImage: (id: string, imageId: string) => api.delete(`/products/${id}/images/${imageId}`).then((r) => r.data),
  assignImageVariant: (id: string, imageId: string, variantId: string | null) =>
    api.patch(`/products/${id}/images/${imageId}/variant`, { variantId }).then((r) => r.data),
};

export const variantsApi = {
  findAll: () => api.get('/product-variants').then((r) => r.data),
  findByProduct: (productId: string) => api.get(`/product-variants/product/${productId}`).then((r) => r.data),
  findOne: (id: string) => api.get(`/product-variants/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/product-variants', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/product-variants/${id}`, data).then((r) => r.data),
  updateStock: (id: string, stock: number) => api.patch(`/product-variants/${id}/stock`, { stock }).then((r) => r.data),
  updatePrice: (id: string, data: Record<string, unknown>) => api.patch(`/product-variants/${id}/price`, data).then((r) => r.data),
  setDefault: (id: string) => api.patch(`/product-variants/${id}/set-default`).then((r) => r.data),
  delete: (id: string) => api.delete(`/product-variants/${id}`).then((r) => r.data),
};

export const customersApi = {
  findAll: (params?: Record<string, unknown>) => api.get('/customers', { params }).then((r) => r.data),
  findOne: (id: string) => api.get(`/customers/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/customers', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/customers/${id}`, data).then((r) => r.data),
  activate: (id: string) => api.patch(`/customers/${id}/activate`).then((r) => r.data),
  deactivate: (id: string) => api.patch(`/customers/${id}/deactivate`).then((r) => r.data),
};

export const ordersApi = {
  findAll: (params?: Record<string, unknown>) => api.get('/orders', { params }).then((r) => r.data),
  findOne: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  updatePaymentStatus: (id: string, paymentStatus: string) =>
    api.patch(`/orders/${id}/payment-status`, { paymentStatus }).then((r) => r.data),
  cancel: (id: string) => api.patch(`/orders/${id}/cancel`).then((r) => r.data),
};

export const reviewsApi = {
  findAll: () => api.get('/product-reviews').then((r) => r.data),
  moderate: (id: string, isApproved: boolean) =>
    api.patch(`/product-reviews/${id}/moderate`, { isApproved }).then((r) => r.data),
};

export const adminsApi = {
  findAll: () => api.get('/admins').then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/admins', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/admins/${id}`, data).then((r) => r.data),
  activate: (id: string) => api.patch(`/admins/${id}/activate`).then((r) => r.data),
  deactivate: (id: string) => api.patch(`/admins/${id}/deactivate`).then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get('/settings/admin').then((r) => r.data),
  update: (data: Record<string, unknown>) => api.patch('/settings/admin', data).then((r) => r.data),
};

export const activityLogsApi = {
  findAll: (params?: Record<string, unknown>) => api.get('/activity-logs', { params }).then((r) => r.data),
  getEntities: () => api.get('/activity-logs/meta/entities').then((r) => r.data),
  getActions: () => api.get('/activity-logs/meta/actions').then((r) => r.data),
};

export const filesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const permissionsApi = {
  getAll: () => api.get('/permissions').then((r) => r.data),
  update: (updates: { role: string; permission: string; allowed: boolean }[]) =>
    api.put('/permissions', { updates }).then((r) => r.data),
};

export const posImportApi = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/pos-import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  import: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/pos-import/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
