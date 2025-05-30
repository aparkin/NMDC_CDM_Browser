import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Grid, CircularProgress } from '@mui/material';
import { API_ENDPOINTS } from '../config/api';

interface Study {
  id: string;
  name: string;
  description: string;
  sample_count: number;
  measurement_types: string[];
  primary_ecosystem: string;
  // ... other study properties
}

const StudyDashboard: React.FC = () => {
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudy = async () => {
      if (!studyId) {
        setError('Study ID is required');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.studies.detail(studyId));
        if (!response.ok) {
          throw new Error('Failed to fetch study details');
        }
        const data = await response.json();
        setStudy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStudy();
  }, [studyId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!study) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Study not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {study.name}
      </Typography>
      
      <Grid container spacing={3}>
        {/* Overview Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Overview
            </Typography>
            <Typography variant="body1" paragraph>
              {study.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sample Count: {study.sample_count}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Primary Ecosystem: {study.primary_ecosystem}
            </Typography>
          </Paper>
        </Grid>

        {/* Placeholder Sections */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Sample Distribution Map
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Measurement Statistics
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Detailed Analysis Dashboard
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudyDashboard; 