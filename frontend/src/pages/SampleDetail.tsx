import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import { MapContainer } from '@/components/MapContainer';
import SampleStatisticsView from '@/components/SampleStatisticsView';
import { ResizableContainer } from '@/components/ResizableContainer';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Sample {
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
  depth?: number;
  temperature?: number;
  ph?: number;
  salinity?: number;
  [key: string]: any;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sample-tabpanel-${index}`}
      aria-labelledby={`sample-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SampleDetail = () => {
  const { studyId, sampleId } = useParams<{ studyId: string; sampleId: string }>();
  const [sample, setSample] = useState<Sample | null>(null);
  const [allSamples, setAllSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisTabValue, setAnalysisTabValue] = useState(0);

  useEffect(() => {
    const fetchSampleData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all samples for the study
        const response = await fetch(`http://localhost:8000/api/v1/study/${studyId}/samples`);
        if (!response.ok) {
          throw new Error(`Failed to fetch samples: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }

        setAllSamples(data);
        
        // Find the specific sample
        const sampleData = data.find(s => s.id === sampleId);
        
        if (!sampleData) {
          throw new Error('Sample not found');
        }
        
        setSample(sampleData);
      } catch (err) {
        console.error('Error fetching sample data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (studyId && sampleId) {
      fetchSampleData();
    }
  }, [studyId, sampleId]);

  const handleAnalysisTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setAnalysisTabValue(newValue);
  };

  if (!studyId || !sampleId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Study ID and Sample ID are required</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
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

  if (!sample) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Sample not found</Typography>
      </Box>
    );
  }

  // Convert all samples to location format for the map
  const mapLocations = allSamples
    .filter(s => s.latitude && s.longitude)
    .reduce((acc: any[], s) => {
      // Find if we already have a location with these coordinates
      const existingLocation = acc.find(loc => 
        loc.latitude === s.latitude && loc.longitude === s.longitude
      );

      if (existingLocation) {
        // Add this sample to the existing location
        existingLocation.samples.push({
          id: s.id,
          sample_name: s.sample_name || 'Unnamed Sample',
          collection_date: s.collection_date || '',
          collection_time: s.collection_time || '',
          ecosystem: s.ecosystem || '',
          ecosystem_type: s.ecosystem_type || '',
          ecosystem_subtype: s.ecosystem_subtype || '',
          specific_ecosystem: s.specific_ecosystem || '',
          depth: s.depth,
          temperature: s.temperature,
          ph: s.ph,
          salinity: s.salinity
        });
        existingLocation.sample_count += 1;
      } else {
        // Create a new location
        acc.push({
          latitude: s.latitude!,
          longitude: s.longitude!,
          sample_count: 1,
          ecosystem: s.ecosystem,
          ecosystem_type: s.ecosystem_type,
          ecosystem_subtype: s.ecosystem_subtype,
          specific_ecosystem: s.specific_ecosystem,
          samples: [{
            id: s.id,
            sample_name: s.sample_name || 'Unnamed Sample',
            collection_date: s.collection_date || '',
            collection_time: s.collection_time || '',
            ecosystem: s.ecosystem || '',
            ecosystem_type: s.ecosystem_type || '',
            ecosystem_subtype: s.ecosystem_subtype || '',
            specific_ecosystem: s.specific_ecosystem || '',
            depth: s.depth,
            temperature: s.temperature,
            ph: s.ph,
            salinity: s.salinity
          }]
        });
      }
      return acc;
    }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {/* Sample Header */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h4" gutterBottom>
          {sample.sample_name || 'Unnamed Sample'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="subtitle1" color="text.secondary">
            Sample ID: {sample.id}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Study ID: {studyId}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          <Typography variant="body2">
            Collection Date: {sample.collection_date || 'N/A'}
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
          {sample.latitude && sample.longitude && (
            <Typography variant="body2">
              Location: {sample.latitude.toFixed(4)}°, {sample.longitude.toFixed(4)}°
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Map & Statistics Container */}
      <ResizableContainer
        title="Map & Statistics"
        defaultHeight={400}
        minHeight={200}
      >
        <Box sx={{ display: 'flex', height: '100%' }}>
          <Box sx={{ flex: 1, p: 2, minWidth: '20%' }}>
            <MapContainer 
              locations={mapLocations} 
              highlightSampleId={sampleId}
            />
          </Box>
          <Box sx={{ flex: 1, p: 2, borderLeft: 1, borderColor: 'divider', minWidth: '20%' }}>
            <SampleStatisticsView 
              studyId={studyId} 
              sampleId={sampleId}
              sampleDate={sample.collection_date}
            />
          </Box>
        </Box>
      </ResizableContainer>

      {/* AI Summary Container */}
      <ResizableContainer
        title="AI Summary"
        defaultHeight={200}
        minHeight={100}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Sample Analysis Summary</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Refresh AI Summary">
              <IconButton size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Paper 
            sx={{ 
              p: 2, 
              height: 'calc(100% - 48px)', 
              overflow: 'auto',
              bgcolor: 'background.default'
            }}
          >
            <Typography variant="body1" color="text.secondary">
              AI-generated summary of sample analysis will appear here. This will include key findings, 
              patterns, and insights derived from the sample's data. The summary will be automatically 
              generated based on the sample's characteristics, measurements, and analysis results.
            </Typography>
          </Paper>
        </Box>
      </ResizableContainer>

      {/* Sample Analysis Container */}
      <ResizableContainer
        title="Sample Analysis"
        defaultHeight={300}
        minHeight={200}
      >
        <Box sx={{ width: '100%' }}>
          <Tabs
            value={analysisTabValue}
            onChange={handleAnalysisTabChange}
            aria-label="sample analysis tabs"
          >
            <Tab label="Taxonomic Distribution" />
            <Tab label="Functional Distribution" />
          </Tabs>

          <TabPanel value={analysisTabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Taxonomic Distribution
            </Typography>
            <Typography color="text.secondary">
              Taxonomic distribution analysis will be displayed here. This will show the 
              distribution of different taxa identified in the sample, including their 
              relative abundances and relationships.
            </Typography>
          </TabPanel>

          <TabPanel value={analysisTabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Functional Distribution
            </Typography>
            <Typography color="text.secondary">
              Functional distribution analysis will be displayed here. This will show the 
              distribution of functional elements identified in the sample, including 
              metabolic pathways, gene functions, and other functional characteristics.
            </Typography>
          </TabPanel>
        </Box>
      </ResizableContainer>
    </Box>
  );
};

export default SampleDetail; 