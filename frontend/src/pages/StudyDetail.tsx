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
import AISummary from '../components/AISummary';
import StudyStatisticsView from '../components/StudyStatisticsView';

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

  useEffect(() => {
    const fetchStudyData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch study details
        const studyResponse = await fetch(`http://localhost:8000/api/v1/study/${studyId}`);
        if (!studyResponse.ok) {
          throw new Error(`Failed to fetch study: ${studyResponse.statusText}`);
        }
        const studyData = await studyResponse.json();
        
        // Fetch study analysis for map data
        const analysisResponse = await fetch(`http://localhost:8000/api/v1/study/${studyId}/analysis`);
        if (!analysisResponse.ok) {
          throw new Error(`Failed to fetch study analysis: ${analysisResponse.statusText}`);
        }
        await analysisResponse.json(); // We don't need to store this data

        // Fetch samples data
        const samplesResponse = await fetch(`http://localhost:8000/api/v1/study/${studyId}/samples`);
        if (!samplesResponse.ok) {
          throw new Error(`Failed to fetch samples: ${samplesResponse.statusText}`);
        }
        const samplesData = await samplesResponse.json();

        // Group samples by location
        const locationMap = new Map<string, any>();
        samplesData.forEach((sample: any) => {
          if (sample.latitude && sample.longitude) {
            const key = `${sample.latitude},${sample.longitude}`;
            if (!locationMap.has(key)) {
              locationMap.set(key, {
                latitude: sample.latitude,
                longitude: sample.longitude,
                sample_count: 0,
                samples: []
              });
            }
            const location = locationMap.get(key);
            location.sample_count++;
            location.samples.push(sample);
          }
        });

        // Convert map to array and combine with study data
        const locations = Array.from(locationMap.values());
        
        // Combine the data
        setStudy({
          ...studyData,
          sample_locations: locations
        });
      } catch (err) {
        console.error('Error fetching study data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (studyId) {
      fetchStudyData();
    }
  }, [studyId]);

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
            <MapContainer locations={study.sample_locations} />
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
        <AISummary />
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