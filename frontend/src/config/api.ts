// Get the backend URL from environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:9000';
console.log('Environment:', import.meta.env.MODE);
console.log('BACKEND_URL:', BACKEND_URL);
console.log('All env vars:', import.meta.env);

// Helper function to construct API URLs
export const getApiUrl = (endpoint: string) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // In development, use the Vite dev server's proxy
  const isDev = import.meta.env.DEV;
  if (isDev) {
    return `/api/${cleanEndpoint}`;
  }
  
  // In production, use the full URL with api prefix
  return `${BACKEND_URL}/api/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  studies: {
    list: () => getApiUrl('studies/cards'),
    detail: (studyId: string) => getApiUrl(`study/${studyId}`),
    analysis: (studyId: string) => getApiUrl(`study/${studyId}/analysis`),
    samples: (studyId: string) => getApiUrl(`study/${studyId}/samples`),
    aiSummary: (studyId: string, forceRefresh = false) => 
      getApiUrl(`studies/${studyId}/summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
  samples: {
    detail: (sampleId: string) => getApiUrl(`sample/${sampleId}`),
    analysis: (sampleId: string) => getApiUrl(`sample/${sampleId}/analysis`),
    aiSummary: (sampleId: string, forceRefresh = false) => 
      getApiUrl(`sample/${sampleId}/summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
  statistics: {
    timeline: () => getApiUrl('statistics/timeline'),
    ecosystem: (ecosystem: string) => getApiUrl(`statistics/ecosystem/${ecosystem}`),
    physical: (type: string) => getApiUrl(`statistics/physical/${type}`),
    omics: (type: string) => getApiUrl(`statistics/omics/${type}`),
    taxonomic: (type: string) => getApiUrl(`statistics/taxonomic/${type}`),
    summary: () => getApiUrl('studies/summary'),
  },
  summary: {
    ai: (forceRefresh = false) => getApiUrl(`summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
}; 