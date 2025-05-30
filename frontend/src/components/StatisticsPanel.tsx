import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Paper, IconButton, Collapse } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { API_ENDPOINTS } from '../config/api';

export interface StatisticsPanelProps {
  studyId: string;
  sampleCount: number;
  measurementTypes: string[];
  ecosystem: string;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  studyId,
  sampleCount,
  measurementTypes,
  ecosystem,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(false);
  const [isMeasurementsCollapsed, setIsMeasurementsCollapsed] = useState(false);
  const [isEnvironmentalCollapsed, setIsEnvironmentalCollapsed] = useState(false);
  const [height, setHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(200, startHeight.current + deltaY);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.studies.analysis(studyId));
        if (!response.ok) throw new Error('Failed to fetch statistics');
        const data = await response.json();
        setStats({
          measurement_coverage: data.omics?.top10 || {},
          environmental_variables: data.physical || {},
          ecosystem: data.ecosystem || {},
          timeline: data.timeline || {}
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [studyId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          Analyzing study data... This may take a few moments
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Study Overview Section */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">Study Overview</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton 
                onClick={() => setIsOverviewCollapsed(!isOverviewCollapsed)} 
                size="small"
                sx={{ color: 'primary.main' }}
              >
                {isOverviewCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
            </Box>
            <Collapse in={!isOverviewCollapsed}>
              <Typography>Sample Count: {sampleCount}</Typography>
              <Typography>Ecosystem: {ecosystem}</Typography>
              <Typography>Measurement Types: {measurementTypes.join(', ')}</Typography>
            </Collapse>
          </Paper>

          {stats && (
            <>
              {/* Measurement Coverage Section */}
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Measurement Coverage</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton 
                    onClick={() => setIsMeasurementsCollapsed(!isMeasurementsCollapsed)} 
                    size="small"
                    sx={{ color: 'primary.main' }}
                  >
                    {isMeasurementsCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                  </IconButton>
                </Box>
                <Collapse in={!isMeasurementsCollapsed}>
                  {Object.entries(stats.measurement_coverage || {}).map(([type, count]) => (
                    <Typography key={type}>
                      {type}: {typeof count === 'number' ? count : 0} samples
                    </Typography>
                  ))}
                </Collapse>
              </Paper>

              {/* Environmental Variables Section */}
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Environmental Variables</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <IconButton 
                    onClick={() => setIsEnvironmentalCollapsed(!isEnvironmentalCollapsed)} 
                    size="small"
                    sx={{ color: 'primary.main' }}
                  >
                    {isEnvironmentalCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                  </IconButton>
                </Box>
                <Collapse in={!isEnvironmentalCollapsed}>
                  {Object.entries(stats.environmental_variables || {}).map(([var_name, data]: [string, any]) => (
                    <Box key={var_name} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">{var_name}</Typography>
                      <Typography variant="body2">
                        Mean: {data.mean.toFixed(2)} ± {data.std.toFixed(2)}
                      </Typography>
                      <Typography variant="body2">
                        Range: {data.min.toFixed(2)} - {data.max.toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Collapse>
              </Paper>
            </>
          )}
        </Box>
      </Box>
      <Box
        onMouseDown={handleResizeStart}
        sx={{
          height: '8px',
          bgcolor: 'primary.main',
          cursor: 'ns-resize',
          '&:hover': { 
            bgcolor: 'primary.dark',
            height: '12px'
          },
          transition: 'all 0.2s ease'
        }}
      />
    </Box>
  );
}; 