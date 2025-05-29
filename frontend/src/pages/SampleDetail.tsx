import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { MapContainer } from '@/components/MapContainer';
import SampleStatisticsView from '@/components/SampleStatisticsView';
import { ResizableContainer } from '@/components/ResizableContainer';
import Plot from 'react-plotly.js';
import { useSampleAnalysis } from '@/hooks/useSampleAnalysis';
import SampleAISummary from '../components/SampleAISummary';
import { API_ENDPOINTS } from '@/config/api';

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
  const [selectedAnnotationClass, setSelectedAnnotationClass] = useState<string>('product');
  const [useLogScale, setUseLogScale] = useState(false);
  const [selectedTaxonomicSource, setSelectedTaxonomicSource] = useState<string>('kraken');

  const { data: sampleAnalysis, isLoading: analysisLoading } = useSampleAnalysis(sampleId);

  useEffect(() => {
    const fetchSampleData = async () => {
      if (!studyId) return;  // Add type guard
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all samples for the study
        const response = await fetch(API_ENDPOINTS.studies.samples(studyId));
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

  const handleAnalysisTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setAnalysisTabValue(newValue);
  };

  const handleAnnotationClassChange = (event: SelectChangeEvent) => {
    setSelectedAnnotationClass(event.target.value);
  };

  const handleTaxonomicSourceChange = (event: SelectChangeEvent) => {
    setSelectedTaxonomicSource(event.target.value);
  };

  const renderFunctionalDistribution = () => {
    if (analysisLoading || !sampleAnalysis) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    const functionalData = sampleAnalysis.functional_analysis;
    if (!functionalData || Object.keys(functionalData).length === 0) {
      return (
        <Alert severity="info">
          No functional analysis data available for this sample.
        </Alert>
      );
    }

    const annotationClasses = Object.keys(functionalData).filter(cls => {
      const data = functionalData[cls];
      return data && Object.keys(data).length > 0;
    });

    if (annotationClasses.length === 0) {
      return (
        <Alert severity="info">
          No functional analysis data available for this sample.
        </Alert>
      );
    }

    if (!annotationClasses.includes(selectedAnnotationClass)) {
      setSelectedAnnotationClass(annotationClasses[0]);
    }

    const selectedData = functionalData[selectedAnnotationClass] || {};
    const sortedData = Object.entries(selectedData)
      .map(([label, value]) => ({
        label: String(label),  // Ensure label is treated as string
        value: Number(value)   // Ensure value is treated as number
      }))
      .sort((a, b) => b.value - a.value)  // Sort by numeric value
      .slice(0, 20); // Show top 20

    if (sortedData.length === 0) {
      return (
        <Alert severity="info">
          No data available for the selected annotation class.
        </Alert>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Annotation Class</InputLabel>
            <Select
              value={selectedAnnotationClass}
              label="Annotation Class"
              onChange={handleAnnotationClassChange}
            >
              {annotationClasses.map(cls => (
                <MenuItem key={cls} value={cls}>
                  {cls.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={useLogScale}
                onChange={(e) => setUseLogScale(e.target.checked)}
              />
            }
            label="Log Scale"
          />
        </Box>

        <Box sx={{ height: 400 }}>
          <Plot
            data={[
              {
                x: sortedData.map(item => item.label),
                y: sortedData.map(item => item.value),
                type: 'bar',
                marker: {
                  color: '#1976d2'
                }
              }
            ]}
            layout={{
              title: `${selectedAnnotationClass.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Distribution`,
              xaxis: {
                title: 'Label',
                tickangle: -45
              },
              yaxis: {
                title: 'Relative Abundance',
                tickformat: '.1%',
                type: useLogScale ? 'log' : 'linear',
                range: useLogScale ? [Math.log10(0.0001), 0] : undefined
              },
              margin: { b: 100 }
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
      </Box>
    );
  };

  const renderTaxonomicDistribution = () => {
    if (analysisLoading || !sampleAnalysis) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    const taxonomicData = sampleAnalysis.taxonomic_treemap;
    if (!taxonomicData || Object.keys(taxonomicData).length === 0) {
      return (
        <Alert severity="info">
          No taxonomic data available for this sample.
        </Alert>
      );
    }

    const availableSources = Object.keys(taxonomicData);
    if (!availableSources.includes(selectedTaxonomicSource)) {
      setSelectedTaxonomicSource(availableSources[0]);
    }

    const selectedData = taxonomicData[selectedTaxonomicSource] || [];
    if (selectedData.length === 0) {
      return (
        <Alert severity="info">
          No data available for the selected taxonomic source.
        </Alert>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Taxonomic Source</InputLabel>
            <Select
              value={selectedTaxonomicSource}
              label="Taxonomic Source"
              onChange={handleTaxonomicSourceChange}
            >
              {availableSources.map(source => (
                <MenuItem key={source} value={source}>
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ height: 600 }}>
          <Plot
            data={[
              {
                type: 'treemap',
                ids: selectedData.map(item => item.ids),
                labels: selectedData.map(item => item.labels),
                parents: selectedData.map(item => item.parents),
                values: selectedData.map(item => item.values),
                branchvalues: "total",
                textinfo: "label+value",
                hovertemplate: '<b>%{label}</b><br>Value: %{value:.1%}<extra></extra>'
              }
            ]}
            layout={{
              title: `${selectedTaxonomicSource.charAt(0).toUpperCase() + selectedTaxonomicSource.slice(1)} Taxonomic Distribution`,
              width: undefined,
              height: undefined,
              margin: { t: 50, b: 25, l: 25, r: 25 }
            }}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true }}
          />
        </Box>
      </Box>
    );
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
        defaultHeight={350}
        minHeight={200}
        maxHeight={600}
      >
        <SampleAISummary sampleId={sampleId} />
      </ResizableContainer>

      {/* Sample Analysis Container */}
      <ResizableContainer
        title="Sample Analysis"
        defaultHeight={800}
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
            {renderTaxonomicDistribution()}
          </TabPanel>

          <TabPanel value={analysisTabValue} index={1}>
            {renderFunctionalDistribution()}
          </TabPanel>
        </Box>
      </ResizableContainer>
    </Box>
  );
};

export default SampleDetail; 