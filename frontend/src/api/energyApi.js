import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 8000,
});

export const getKPIs            = (period)       => api.get('/api/energy/kpis', { params: { period } }).then(r => r.data);
export const getLatest          = ()             => api.get('/api/energy/latest').then(r => r.data);
export const getMonthlyKPIs     = ()             => api.get('/api/energy/monthly').then(r => r.data);
export const getAnomalies       = ()             => api.get('/api/energy/anomalies').then(r => r.data);
export const getAnomaliesHistory= ()             => api.get('/api/energy/anomalies/history').then(r => r.data);
export const getMonthlyReport   = (month)        => api.get('/api/energy/reports', { params: { month } }).then(r => r.data);
export const getZonesDetail     = ()             => api.get('/api/energy/zones').then(r => r.data);
export const getPredictions     = ()             => api.get('/api/energy/predictions').then(r => r.data);
export const getSimulatorStatus = ()             => api.get('/api/simulate/status').then(r => r.data);
export const startSimulator     = ()             => api.post('/api/simulate/start').then(r => r.data);
export const stopSimulator      = ()             => api.post('/api/simulate/stop').then(r => r.data);

