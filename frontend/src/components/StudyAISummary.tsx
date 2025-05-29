import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';
import { API_ENDPOINTS } from '../config/api';

interface StudyAISummaryData {
  summary: string;
  last_updated: string;
}

interface StudyAISummaryProps {
  studyId: string;
}

const StudyAISummary: React.FC<StudyAISummaryProps> = ({ studyId }) => {
  const [summary, setSummary] = useState<StudyAISummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSummary = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.studies.aiSummary(studyId, forceRefresh));
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch study summary: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }
      setSummary(data);
      setError(null);
    } catch (err) {
      console.error('Error in fetchSummary:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching the summary');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [studyId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSummary(true);
  };

  if (loading && !isRefreshing) {
    return (
      <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box display="flex" justifyContent="center">
          <IconButton 
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="small"
          >
            {isRefreshing ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </Box>
      </Paper>
    );
  }

  if (!summary) {
    return (
      <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Generate new summary">
            <IconButton 
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="small"
            >
              {isRefreshing ? (
                <CircularProgress size={20} />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Click the refresh button to generate a summary of this study...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Generate new summary">
          <IconButton 
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="small"
          >
            {isRefreshing ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ pr: 2 }}>
        <ReactMarkdown>
          {summary.summary}
        </ReactMarkdown>
      </Box>
    </Paper>
  );
};

export default StudyAISummary; 