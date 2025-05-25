import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, IconButton, Tooltip } from '@mui/material';
import { format } from 'date-fns';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';

interface AISummaryData {
  summary: string;
  last_updated: string;
  data_version: string;
}

const AISummary: React.FC = () => {
  const [summary, setSummary] = useState<AISummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSummary = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/summary/ai${forceRefresh ? '?force=true' : ''}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch AI summary: ${response.status} ${response.statusText}`);
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
  }, []);

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
          Click the refresh button to generate a summary of the compendium...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, minHeight: '32px' }}>
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
      
      <Box sx={{ 
        flex: 1,
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#888',
          borderRadius: '4px',
          '&:hover': {
            background: '#555',
          },
        },
        mb: 2
      }}>
        <Box sx={{ pr: 2 }}>
          <ReactMarkdown>
            {summary.summary}
          </ReactMarkdown>
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Last updated: {format(new Date(summary.last_updated), 'PPpp')}
      </Typography>
    </Paper>
  );
};

export default AISummary; 