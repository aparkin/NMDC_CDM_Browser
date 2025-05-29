import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  CircularProgress,
  IconButton,
  Collapse,
  Alert,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { MapContainer } from './MapContainer';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';

export interface Sample {
  id: string;
  sample_name?: string;
  collection_date?: string;
  collection_time?: string;
  ecosystem?: string;
  ecosystem_category?: string;
  ecosystem_type?: string;
  ecosystem_subtype?: string;
  specific_ecosystem?: string;
  latitude?: number;
  longitude?: number;
}

interface SampleRibbonProps {
  studyId: string;
}

export const SampleRibbon: React.FC<SampleRibbonProps> = ({ studyId }) => {
  const navigate = useNavigate();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.studies.samples(studyId));
      if (!response.ok) {
        throw new Error('Failed to fetch samples');
      }
      const data = await response.json();
      setSamples(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching samples:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching samples');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studyId) {
      fetchSamples();
    }
  }, [studyId]);

  const filteredSamples = samples?.filter(sample => {
    const searchLower = searchTerm.toLowerCase();
    return searchTerm === '' || 
      Object.values(sample).some(value => {
        if (value === null || value === undefined) return false;
        const strValue = value.toString().toLowerCase();
        return strValue.includes(searchLower);
      });
  }) || [];

  // Convert samples to locations for the map
  const mapLocations = filteredSamples
    .filter(sample => sample.latitude && sample.longitude)
    .map(sample => ({
      latitude: sample.latitude!,
      longitude: sample.longitude!,
      sample_count: 1,
      ecosystem: sample.ecosystem,
      ecosystem_type: sample.ecosystem_type,
      ecosystem_subtype: sample.ecosystem_subtype,
      specific_ecosystem: sample.specific_ecosystem,
    }));

  const handleSampleClick = (sampleId: string) => {
    navigate(`/studies/${studyId}/samples/${sampleId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1, 
        borderBottom: 1, 
        borderColor: 'divider' 
      }}>
        <Typography variant="h6">Samples</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton 
          onClick={() => setShowMap(!showMap)}
          size="small"
          sx={{ color: 'primary.main', mr: 1 }}
        >
          {showMap ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <IconButton 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          size="small"
          sx={{ color: 'primary.main' }}
        >
          {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      
      <Collapse in={showMap}>
        <Box sx={{ height: 400, width: '100%', mb: 2 }}>
          <MapContainer locations={mapLocations} />
        </Box>
      </Collapse>

      <Collapse in={!isCollapsed}>
        <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Search samples"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 1 }}
            />
          </Box>

          <Box sx={{ 
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            paddingBottom: 2,
            overflowX: 'auto',
            '&::-webkit-scrollbar': {
              height: '8px',
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
          }}>
            {filteredSamples.map((sample) => (
              <Box
                key={sample.id}
                sx={{
                  minWidth: 250,
                  maxWidth: 300,
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                onClick={() => handleSampleClick(sample.id)}
              >
                <Paper 
                  sx={{ 
                    p: 2, 
                    height: '100%',
                    '&:hover': {
                      boxShadow: 6,
                    },
                  }}
                >
                  <Typography 
                    variant="subtitle1" 
                    gutterBottom 
                    sx={{ 
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  >
                    {sample.sample_name || 'Unnamed Sample'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      ID: {sample.id}
                    </Typography>
                    <Typography variant="body2">
                      Collection: {sample.collection_date || 'N/A'}
                      {sample.collection_time ? ` at ${sample.collection_time}` : ''}
                    </Typography>
                    <Typography variant="body2">
                      Ecosystem: {sample.ecosystem || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Category: {sample.ecosystem_category || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Type: {sample.ecosystem_type || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Subtype: {sample.ecosystem_subtype || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Specific: {sample.specific_ecosystem || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      Location: {sample.latitude && sample.longitude ? 
                        `${sample.latitude.toFixed(4)}°, ${sample.longitude.toFixed(4)}°` : 
                        'N/A'}
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}; 
