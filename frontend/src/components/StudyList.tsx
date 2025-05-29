import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, Typography, Chip, Box, Collapse, IconButton, Paper } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useNavigate } from 'react-router-dom';
import { StudyMap } from './StudyMap';
import StatisticsView from './StatisticsView';
import AISummary from './AISummary';
import { ResizableContainer } from './ResizableContainer';
import { API_ENDPOINTS } from '../config/api';

interface Study {
  id: string;
  name: string;
  description: string;
  sample_count: number;
  measurement_types: string[];
  primary_ecosystem: string;
  add_date: string | null;
  lipidomics_processed: number;
  mags_analysis: number;
  metabolomics_processed: number;
  metagenome_processed: number;
  metatranscriptome_processed: number;
  nom_analysis: number;
  proteomics_processed: number;
  read_based_analysis: number;
  reads_qc: number;
  ecosystem: string;
  ecosystem_category: string;
  ecosystem_subtype: string;
  ecosystem_type: string;
  quantitative_measurements: {
    [key: string]: number;
  };
  latitude?: number;
  longitude?: number;
  sample_locations?: { latitude: number; longitude: number }[];
}

const StudyList: React.FC = () => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const navigate = useNavigate();
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<'mapStats' | 'summary' | null>(null);
  const startY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const [height, setHeight] = useState(400);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaY = e.clientY - startY.current;
      const newHeight = Math.max(200, startHeight.current + deltaY);

      if (resizeType === 'mapStats') {
        setHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeType(null);
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
  }, [isResizing, resizeType]);

  const fetchStudies = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.studies.list());
      if (!response.ok) {
        throw new Error('Failed to fetch studies');
      }
      const data = await response.json();
      setStudies(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching studies:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudies();
  }, []);

  const filteredStudies = studies.filter(study => 
    study.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderMeasurementCount = (count: number) => {
    if (count === 0 || isNaN(count)) return '0';
    return count.toLocaleString();
  };

  const handleCardClick = (studyId: string, event: React.MouseEvent) => {
    // Prevent navigation if clicking on the expand button or its children
    if ((event.target as HTMLElement).closest('.MuiIconButton-root')) {
      return;
    }
    navigate(`/studies/${studyId}`);
  };

  // Memoize the studies data for the map
  const mapStudies = useMemo(() => {
    return studies
      .filter(study => study.latitude && study.longitude)
      .map(study => ({
        id: study.id,
        name: study.name,
        latitude: study.latitude!,
        longitude: study.longitude!,
        sample_count: study.sample_count,
        ecosystem: study.ecosystem || 'Unknown',
        measurement_types: study.measurement_types || [],
        lipidomics_processed: study.lipidomics_processed,
        mags_analysis: study.mags_analysis,
        metabolomics_processed: study.metabolomics_processed,
        metagenome_processed: study.metagenome_processed,
        metatranscriptome_processed: study.metatranscriptome_processed,
        nom_analysis: study.nom_analysis,
        proteomics_processed: study.proteomics_processed,
        read_based_analysis: study.read_based_analysis,
        reads_qc: study.reads_qc,
        sample_locations: study.sample_locations || []
      }));
  }, [studies]);

  const handleResize = (height: number) => {
    setHeight(height);
  };

  if (loading) {
    return <Typography>Loading studies...</Typography>;
  }

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
      p: 3,
      boxSizing: 'border-box',
      flex: 1,
      overflow: 'auto'
    }}>
      <Box sx={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: { sm: `calc(100vw - ${240 + 48}px)` } // drawerWidth + padding
      }}>
        {/* Map and Statistics Section */}
        <ResizableContainer
          title="Map & Statistics"
          defaultHeight={height}
          minHeight={300}
          maxHeight={800}
          onResize={handleResize}
        >
          <Box sx={{ 
            height: '100%',
            display: 'flex',
            gap: 2,
            width: '100%'
          }}>
            {/* Map */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <StudyMap studies={mapStudies} />
              </Paper>
            </Box>
            
            {/* Statistics */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <StatisticsView />
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

        {/* Studies Section */}
        <ResizableContainer
          title="Studies"
          defaultHeight={500}
          minHeight={300}
          maxHeight={800}
        >
          <Box sx={{ width: '100%', minWidth: { sm: `calc(100vw - ${240 + 48}px)` } }}>
            {/* Search Bar */}
            <Box sx={{ mb: 2 }}>
              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '300px',
                  padding: '8px',
                  fontSize: '16px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
            </Box>

            {/* Study Cards Container */}
            <Box sx={{ 
              width: '100%',
              overflowX: 'auto',
              '&::-webkit-scrollbar': {
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '4px',
              },
            }}>
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                minWidth: 'fit-content',
                p: 1
              }}>
                {filteredStudies.map((study) => (
                  <Box
                    key={study.id}
                    sx={{
                      width: 300,
                      flexShrink: 0,
                      '&:last-child': {
                        mr: 0
                      }
                    }}
                  >
                    <Card 
                      onClick={(e) => handleCardClick(study.id, e)}
                      sx={{ 
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        textDecoration: 'none',
                        height: 'fit-content',
                        cursor: 'pointer',
                        '&:hover': {
                          boxShadow: 6,
                        },
                      }}
                    >
                      <CardContent sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        '&:last-child': {
                          pb: 2
                        }
                      }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', mb: 1 }}>
                          <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                            {study.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {study.id}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {study.description}
                        </Typography>
                        
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Samples: {study.sample_count}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            Ecosystem: {study.ecosystem || 'Unknown'}
                          </Typography>
                        </Box>

                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click from firing
                            setExpandedCard(expandedCard === study.id ? null : study.id);
                          }}
                          sx={{ mt: 1, alignSelf: 'flex-start' }}
                        >
                          {expandedCard === study.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>

                        <Collapse in={expandedCard === study.id}>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Omics Measurements:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {Object.entries({
                                'Lipidomics': study.lipidomics_processed,
                                'MAGs': study.mags_analysis,
                                'Metabolomics': study.metabolomics_processed,
                                'Metagenome': study.metagenome_processed,
                                'Metatranscriptome': study.metatranscriptome_processed,
                                'NOM': study.nom_analysis,
                                'Proteomics': study.proteomics_processed,
                                'Read-based': study.read_based_analysis,
                                'Reads QC': study.reads_qc,
                              }).map(([name, count]) => (
                                <Chip
                                  key={name}
                                  label={`${name}: ${renderMeasurementCount(count)}`}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                            </Box>

                            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                              Ecosystem Details:
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="body2">
                                Category: {study.ecosystem_category || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                Type: {study.ecosystem_type || 'N/A'}
                              </Typography>
                              <Typography variant="body2">
                                Subtype: {study.ecosystem_subtype || 'N/A'}
                              </Typography>
                            </Box>

                            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                              Available Measurements:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {Object.entries(study.quantitative_measurements || {})
                                .filter(([_, count]) => count > 0)
                                .map(([name, count]) => (
                                  <Chip
                                    key={name}
                                    label={`${name}: ${count}`}
                                    size="small"
                                    sx={{ mr: 0.5, mb: 0.5 }}
                                  />
                              ))}
                            </Box>
                          </Box>
                        </Collapse>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </ResizableContainer>
      </Box>
    </Box>
  );
};

export default StudyList; 