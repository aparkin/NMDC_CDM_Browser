import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Chip, Box, Collapse, IconButton, Paper } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useNavigate } from 'react-router-dom';
import StudyMap from './StudyMap';
import StatisticalSummary from './StatisticalSummary';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudies = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/studies/cards');
        if (!response.ok) {
          throw new Error('Failed to fetch studies');
        }
        const data = await response.json();
        setStudies(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchStudies();
  }, []);

  // Debug logging for data mapping
  useEffect(() => {
    console.log('Current studies:', studies);
    const studiesWithCoords = studies.filter(study => study.latitude && study.longitude);
    console.log('Studies with coordinates:', studiesWithCoords);
    console.log('Number of studies with coordinates:', studiesWithCoords.length);
    
    const mappedStudies = studiesWithCoords.map(study => {
      console.log('Mapping study:', study.name, 'with coords:', study.latitude, study.longitude);
      return {
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
        sample_locations: (study as any).sample_locations || [] // Pass sample locations to map
      };
    });
    console.log('Mapped studies for map:', mappedStudies);
    console.log('Number of mapped studies:', mappedStudies.length);
  }, [studies]);

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
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      p: 3,
      boxSizing: 'border-box',
      flex: 1,
      overflow: 'hidden'
    }}>
      {/* Fixed width container for all content */}
      <Box sx={{ 
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto'
      }}>
        {/* Summary Section */}
        <Box sx={{ 
          mb: 2, 
          width: '100%'
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            mb: 2, 
            width: '100%'
          }}>
            {/* Map */}
            <Box sx={{ 
              flex: 1, 
              minWidth: 0, 
              height: '300px'
            }}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <StudyMap studies={studies
                  .filter(study => 
                    study.latitude && 
                    study.longitude
                  )
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
                  }))} />
              </Paper>
            </Box>
            
            {/* Statistical Summary */}
            <Box sx={{ 
              flex: 1, 
              minWidth: 0
            }}>
              <StatisticalSummary />
            </Box>
          </Box>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 2, width: '100%' }}>
          <input
            type="text"
            placeholder="Search studies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </Box>

        {/* Study Cards Ribbon */}
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
            gap: 2,
            minWidth: '100vw',
            width: '100%',
            paddingBottom: 2,
            paddingRight: 3
          }}>
            {filteredStudies.map((study) => (
              <Card 
                key={study.id}
                onClick={(e) => handleCardClick(study.id, e)}
                sx={{ 
                  minWidth: 300,
                  maxWidth: 300,
                  flexShrink: 0,
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
                  <Typography variant="h6" gutterBottom>
                    {study.name}
                  </Typography>
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
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default StudyList; 