import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { MapContainer } from '@/components/MapContainer';
import { SampleRibbon } from '@/components/SampleRibbon';
import { ResizableContainer } from '@/components/ResizableContainer';
import StudyAISummary from '../components/StudyAISummary';
import StudyStatisticsView from '@/components/StudyStatisticsView';
import { API_ENDPOINTS } from '../config/api';
import type { Sample } from '@/types';
import './StudyDetail.css';

interface Study {
  id: string;
  name: string;
  description: string;
  sample_count: number;
  measurement_types: string[];
  primary_ecosystem: string;
  add_date: string | null;
  ecosystem: string;
  ecosystem_category: string;
  ecosystem_subtype: string;
  ecosystem_type: string;
  quantitative_measurements: {
    [key: string]: number;
  };
  sample_locations: Array<{
    latitude: number;
    longitude: number;
    sample_count: number;
    samples?: Array<{
      id: string;
      sample_name: string;
      collection_date: string;
      collection_time: string;
      ecosystem: string;
      ecosystem_type: string;
      ecosystem_subtype: string;
      specific_ecosystem: string;
      depth?: number;
      temperature?: number;
      ph?: number;
      salinity?: number;
      [key: string]: any;
    }>;
  }>;
}

const StudyDetail: React.FC = () => {
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSamples, setHasSamples] = useState(true);
  const [selectedSampleId, setSelectedSampleId] = useState<string | undefined>(undefined);
  const [targetSampleId, setTargetSampleId] = useState<string | undefined>(undefined);
  const [highlightSampleId, setHighlightSampleId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      if (!studyId) return;
      
      try {
        // Fetch study details
        const studyResponse = await fetch(API_ENDPOINTS.studies.detail(studyId));
        if (!studyResponse.ok) throw new Error('Failed to fetch study details');
        const studyData = await studyResponse.json();
        setStudy(studyData);

        // Fetch samples first to check if study has any samples
        const samplesResponse = await fetch(API_ENDPOINTS.studies.samples(studyId));
        if (!samplesResponse.ok) throw new Error('Failed to fetch samples');
        const samplesData = await samplesResponse.json();

        if (!samplesData || samplesData.length === 0) {
          setHasSamples(false);
          setLoading(false);
          return;
        }

        // Only fetch analysis data if we have samples
        const analysisResponse = await fetch(API_ENDPOINTS.studies.analysis(studyId));
        if (!analysisResponse.ok) throw new Error('Failed to fetch analysis data');
        await analysisResponse.json(); // Just check if the response is valid

        // Group samples by location
        const locationMap = new Map<string, any>();
        const sampleDataMap = new Map<string, any>(); // Track sample data by ID

        samplesData.forEach((sample: any) => {
          if (sample.latitude && sample.longitude) {
            const key = `${sample.latitude},${sample.longitude}`;
            
            // Merge data for samples with the same ID
            if (sampleDataMap.has(sample.id)) {
              const existingData = sampleDataMap.get(sample.id);
              // Merge the data, keeping non-null values
              Object.keys(sample).forEach(k => {
                if (sample[k] != null && (existingData[k] == null || existingData[k] === '')) {
                  existingData[k] = sample[k];
                }
              });
            } else {
              sampleDataMap.set(sample.id, { ...sample });
            }

            if (!locationMap.has(key)) {
              locationMap.set(key, {
                latitude: sample.latitude,
                longitude: sample.longitude,
                sample_count: 0,
                samples: []
              });
            }
            const location = locationMap.get(key);
            
            // Only add the sample if it's not already in this location
            if (!location.samples.some((s: any) => s.id === sample.id)) {
              location.sample_count++;
              location.samples.push(sampleDataMap.get(sample.id));
            }
          }
        });

        // Convert map to array and combine with study data
        const locations = Array.from(locationMap.values());
        
        // Combine the data
        setStudy({
          ...studyData,
          sample_locations: locations
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
  }, [studyId]);

  const handleSampleClick = (sample: Sample) => {
    setSelectedSampleId(sample.id);
    setTargetSampleId(sample.id);
    setHighlightSampleId(sample.id);
  };

  if (!studyId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Study ID is required</Alert>
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
        <Alert severity="error">
          {error}
        </Alert>
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

  if (!hasSamples) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>
            {study.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Study ID: {study.id}
          </Typography>
          <Typography variant="body1" paragraph>
            {study.description}
          </Typography>
          <Alert severity="info">
            This study has no samples available for analysis.
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {/* Study Header */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h4" gutterBottom>
          {study.name}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Study ID: {study.id}
        </Typography>
        <Typography variant="body1" paragraph>
          {study.description}
        </Typography>
      </Paper>

      {/* Map & Statistics Container */}
      <ResizableContainer
        title="Map & Statistics"
        defaultHeight={500}
        minHeight={300}
        maxHeight={800}
      >
        <Box sx={{ display: 'flex', height: '100%' }}>
          <Box sx={{ flex: 1, p: 2, minWidth: '20%' }}>
            <MapContainer
              locations={study.sample_locations}
              onSampleClick={handleSampleClick}
              selectedSampleId={selectedSampleId}
              targetSampleId={targetSampleId}
              highlightSampleId={highlightSampleId}
            />
          </Box>
          <Box sx={{ flex: 1, p: 2, borderLeft: 1, borderColor: 'divider', minWidth: '20%' }}>
            <StudyStatisticsView studyId={studyId} />
          </Box>
        </Box>
      </ResizableContainer>

      {/* AI Summary Section */}
      <ResizableContainer
        title="AI Summary"
        defaultHeight={350}
        minHeight={200}
        maxHeight={600}
      >
        <StudyAISummary studyId={studyId!} />
      </ResizableContainer>

      {/* Sample Ribbon */}
      <ResizableContainer
        title="Samples"
        defaultHeight={400}
        minHeight={200}
        maxHeight={800}
      >
        <SampleRibbon studyId={studyId!} />
      </ResizableContainer>
    </Box>
  );
};

export default StudyDetail; 