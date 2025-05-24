import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import Plot from 'react-plotly.js';
import axios from 'axios';

interface SummaryStats {
  total_studies: number;
  total_samples: number;
  date_range: {
    start: string | null;
    end: string | null;
  };
  ecosystem_distribution: Record<string, number>;
  measurement_distribution: Record<string, {
    total: number;
    studies: number;
    mean_per_study: number;
  }>;
  ecosystem_type_distribution: Record<string, Record<string, number>>;
  sample_count_stats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    std: number;
  };
  time_series?: {
    dates: string[];
    counts: number[];
  };
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography color="error">
            Error loading statistics: {this.state.error?.message}
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

const StatisticalSummary: React.FC = () => {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/api/studies/summary');
        
        // Validate response data structure
        if (!response.data || typeof response.data !== 'object') {
          throw new Error('Invalid response format from server');
        }

        const data = response.data as SummaryStats;
        
        // Validate required fields
        if (!data.sample_count_stats || typeof data.sample_count_stats !== 'object') {
          throw new Error('Missing or invalid sample count statistics');
        }

        if (typeof data.sample_count_stats.mean !== 'number' ||
            typeof data.sample_count_stats.median !== 'number' ||
            typeof data.sample_count_stats.min !== 'number' ||
            typeof data.sample_count_stats.max !== 'number' ||
            typeof data.sample_count_stats.std !== 'number') {
          throw new Error('Invalid sample count statistics format');
        }

        setStats(data);
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch summary statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error || 'No data available'}</Typography>
      </Box>
    );
  }

  // Additional runtime check before rendering
  if (!stats.sample_count_stats || typeof stats.sample_count_stats.mean !== 'number') {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Invalid statistics data format</Typography>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Overall Statistics */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Overall Statistics
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography variant="subtitle2">Total Studies</Typography>
                <Typography variant="h4">{stats.total_studies}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography variant="subtitle2">Total Samples</Typography>
                <Typography variant="h4">{stats.total_samples.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography variant="subtitle2">Mean Samples/Study</Typography>
                <Typography variant="h4">{Math.round(stats.sample_count_stats.mean)}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                <Typography variant="subtitle2">Date Range</Typography>
                <Typography variant="body2">
                  {stats.date_range.start ? new Date(stats.date_range.start).toLocaleDateString() : 'N/A'} - 
                  {stats.date_range.end ? new Date(stats.date_range.end).toLocaleDateString() : 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Time Series Plot */}
          {stats.time_series && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Study Timeline
              </Typography>
              <Plot
                data={[
                  {
                    x: stats.time_series.dates,
                    y: stats.time_series.counts,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: 'Studies Added'
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 300,
                  margin: { l: 50, r: 50, t: 50, b: 50 }
                }}
                style={{ width: '100%' }}
              />
            </Paper>
          )}

          {/* Charts Row */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {/* Ecosystem Distribution */}
            <Paper sx={{ p: 2, flex: '1 1 400px', minWidth: 0 }}>
              <Typography variant="h6" gutterBottom>
                Ecosystem Distribution
              </Typography>
              <Plot
                data={[
                  {
                    values: Object.values(stats.ecosystem_distribution),
                    labels: Object.keys(stats.ecosystem_distribution),
                    type: 'pie',
                    name: 'Ecosystems'
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 300,
                  margin: { l: 50, r: 50, t: 50, b: 50 }
                }}
                style={{ width: '100%' }}
              />
            </Paper>

            {/* Measurement Distribution */}
            <Paper sx={{ p: 2, flex: '1 1 400px', minWidth: 0 }}>
              <Typography variant="h6" gutterBottom>
                Measurement Coverage
              </Typography>
              <Plot
                data={[
                  {
                    x: Object.keys(stats.measurement_distribution),
                    y: Object.values(stats.measurement_distribution).map(m => m.studies),
                    type: 'bar',
                    name: 'Studies with Measurement'
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 300,
                  margin: { l: 50, r: 50, t: 50, b: 50 }
                }}
                style={{ width: '100%' }}
              />
            </Paper>
          </Box>

          {/* Sample Count Statistics */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Sample Count Statistics
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <Typography variant="subtitle2">Mean</Typography>
                <Typography variant="h6">{Math.round(stats.sample_count_stats.mean)}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <Typography variant="subtitle2">Median</Typography>
                <Typography variant="h6">{Math.round(stats.sample_count_stats.median)}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <Typography variant="subtitle2">Min</Typography>
                <Typography variant="h6">{stats.sample_count_stats.min}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <Typography variant="subtitle2">Max</Typography>
                <Typography variant="h6">{stats.sample_count_stats.max}</Typography>
              </Box>
              <Box sx={{ flex: '1 1 150px', minWidth: 0 }}>
                <Typography variant="subtitle2">Std Dev</Typography>
                <Typography variant="h6">{Math.round(stats.sample_count_stats.std)}</Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

export default StatisticalSummary; 