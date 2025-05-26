import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  CircularProgress,
  IconButton,
  Collapse,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { MapContainer } from './MapContainer';

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
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const fetchSamples = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching samples for study:', studyId);
        
        const response = await fetch(`http://localhost:8000/api/v1/study/${studyId}/samples`);
        if (!response.ok) {
          throw new Error(`Failed to fetch samples: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Received samples data:', data);
        
        if (!Array.isArray(data)) {
          console.warn('Invalid samples data structure:', data);
          setSamples([]);
          return;
        }
        
        // Process the samples
        const allSamples = data
          .map((sample: any) => {
            if (!sample || typeof sample !== 'object') {
              console.warn('Invalid sample data:', sample);
              return null;
            }
            console.log('Processing sample:', sample); // Debug log
            const processedSample: Sample = {
              id: sample.id || 'unknown',
              sample_name: sample.sample_name || 'Unnamed Sample',
              collection_date: sample.collection_date || null,
              collection_time: sample.collection_time || null,
              ecosystem: sample.ecosystem || null,
              ecosystem_category: sample.ecosystem_category || null,
              ecosystem_type: sample.ecosystem_type || null,
              ecosystem_subtype: sample.ecosystem_subtype || null,
              specific_ecosystem: sample.specific_ecosystem || null,
              latitude: typeof sample.latitude === 'number' ? sample.latitude : 
                       typeof sample.latitude === 'string' ? parseFloat(sample.latitude) : null,
              longitude: typeof sample.longitude === 'number' ? sample.longitude : 
                        typeof sample.longitude === 'string' ? parseFloat(sample.longitude) : null,
            };
            console.log('Processed sample with coordinates:', processedSample); // Debug log
            return processedSample;
          })
          .filter((sample): sample is Sample => sample !== null); // Type guard to remove nulls
        
        console.log('Processed samples:', allSamples);
        
        if (allSamples.length === 0) {
          console.warn('No samples found after processing');
        } else {
          console.log('Successfully processed', allSamples.length, 'samples');
        }
        
        setSamples(allSamples);
      } catch (err) {
        console.error('Error fetching samples:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching samples');
      } finally {
        setLoading(false);
      }
    };

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
        <Typography color="error">Error: {error}</Typography>
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
                  flexShrink: 0
                }}
              >
                <Paper sx={{ p: 2, height: '100%' }}>
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
