// Get the backend URL from environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:9000';

// Helper function to construct API URLs
export const getApiUrl = (endpoint: string) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${BACKEND_URL}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  studies: {
    list: () => getApiUrl('api/studies/cards'),
    detail: (studyId: string) => getApiUrl(`api/v1/study/${studyId}`),
    analysis: (studyId: string) => getApiUrl(`api/v1/study/${studyId}/analysis`),
    samples: (studyId: string) => getApiUrl(`api/v1/study/${studyId}/samples`),
    aiSummary: (studyId: string, forceRefresh = false) => 
      getApiUrl(`api/studies/${studyId}/summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
  samples: {
    detail: (sampleId: string) => getApiUrl(`api/v1/sample/${sampleId}`),
    analysis: (sampleId: string) => getApiUrl(`api/v1/sample/${sampleId}/analysis`),
    aiSummary: (sampleId: string, forceRefresh = false) => 
      getApiUrl(`api/v1/sample/${sampleId}/summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
  statistics: {
    timeline: () => getApiUrl('api/statistics/timeline'),
    ecosystem: (ecosystem: string) => getApiUrl(`api/statistics/ecosystem/${ecosystem}`),
    physical: (type: string) => getApiUrl(`api/statistics/physical/${type}`),
    omics: (type: string) => getApiUrl(`api/statistics/omics/${type}`),
    taxonomic: (type: string) => getApiUrl(`api/statistics/taxonomic/${type}`),
    summary: () => getApiUrl('api/studies/summary'),
  },
  summary: {
    ai: (forceRefresh = false) => getApiUrl(`api/summary/ai${forceRefresh ? '?force=true' : ''}`),
  },
}; 