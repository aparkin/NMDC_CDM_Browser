import React, { useState, useEffect, useCallback } from 'react';

interface StudyAISummaryProps {
  studyId: string;
}

export const StudyAISummary: React.FC<StudyAISummaryProps> = ({ studyId }) => {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSummary = useCallback(async (forceRefresh = false) => {
    if (loading) return; // Prevent concurrent calls
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/studies/${studyId}/summary/ai?force=${forceRefresh}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSummary(data.summary);
      setLastUpdated(new Date(data.last_updated));
    } catch (err) {
      console.error('Error fetching AI summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch AI summary');
    } finally {
      setLoading(false);
    }
  }, [studyId, loading]);

  useEffect(() => {
    fetchSummary();
  }, [studyId, fetchSummary]);

  if (loading) {
    return <div>Loading AI summary...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>AI-Generated Summary</h2>
      {lastUpdated && (
        <p>Last updated: {lastUpdated.toLocaleString()}</p>
      )}
      <div>{summary}</div>
      <button 
        onClick={() => fetchSummary(true)}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh Summary'}
      </button>
    </div>
  );
}; 