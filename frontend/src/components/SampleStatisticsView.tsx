import React, { useState } from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Paper,
  Typography,
  Alert,
  CircularProgress,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Plot from 'react-plotly.js';
import type { Data } from 'plotly.js';
import RefreshIcon from '@mui/icons-material/Refresh';

interface SampleStatisticsViewProps {
  studyId: string;
  sampleId: string;
  sampleDate?: string;
}

interface TimelineData {
  study_timelines: Array<{
    study_id: string;
    start_date: string;
    end_date: string;
    sample_count: number;
  }>;
  sample_timeline: Array<{
    sample_id: string;
    date: string;
    study_id: string;
  }>;
}

interface EcosystemVariable {
  key: string;
  value: string;
  studyFraction: number;
  compendiumFraction: number;
}

interface PhysicalVariableData {
  status: string;
  value: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
  compendium_mean: number;
  compendium_std: number;
  compendium_study_count: number;
  p_value: number;
  significant: boolean;
  effect_size: number;
}

interface OmicsItem {
  id: string;
  name: string;
  abundance: number;
  mean_abundance: number;
  std_abundance?: number;
  sample_count?: number;
}

interface TaxonomicItem {
  id: string;
  name?: string;
  abundance: number;
  mean_abundance?: number;
  std_abundance?: number;
  sample_count?: number;
}

interface StudyAnalysisData {
  ecosystem: {
    ecosystem_data: Record<string, string[]>;
    sample_counts: Record<string, Record<string, number>>;
    most_common: Record<string, string>;
  };
  physical: {
    [key: string]: PhysicalVariableData;
  };
  omics: {
    top10: {
      [key: string]: OmicsItem[];
    };
  };
  taxonomic: {
    top10: {
      [key: string]: {
        [key: string]: TaxonomicItem[];
      };
    };
  };
}

const ECOSYSTEM_VARIABLES = [
  'ecosystem',
  'ecosystem_category',
  'ecosystem_subtype',
  'ecosystem_type',
  'env_broad_scale_label',
  'env_local_scale_label',
  'specific_ecosystem',
  'env_medium_label',
  'soil_horizon',
  'soil_type'
];

const PHYSICAL_VARIABLES = [
  'temperature',
  'ph',
  'salinity',
  'depth',
  'water_content_numeric',
  'latitude',
  'longitude'
];

const OMICS_TYPES = [
  'metabolomics',
  'lipidomics',
  'proteomics'
];

const TAXONOMIC_TYPES = [
  'gottcha',
  'kraken',
  'centrifuge',
  'contigs'
];

const TAXONOMIC_RANKS = [
  'superkingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species'
];

const SampleStatisticsView: React.FC<SampleStatisticsViewProps> = ({ 
  studyId, 
  sampleId,
  sampleDate 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPhysical, setSelectedPhysical] = useState(PHYSICAL_VARIABLES[0]);
  const [selectedOmics, setSelectedOmics] = useState(OMICS_TYPES[0]);
  const [selectedTaxonomic, setSelectedTaxonomic] = useState(TAXONOMIC_TYPES[0]);
  const [selectedRank, setSelectedRank] = useState(TAXONOMIC_RANKS[0]);

  // Fetch sample data
  const sampleQuery = useQuery({
    queryKey: ['sample', studyId, sampleId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/v1/sample/${sampleId}/analysis`);
      if (!response.ok) throw new Error('Failed to fetch sample data');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  // Fetch study analysis data
  const studyAnalysisQuery = useQuery<StudyAnalysisData>({
    queryKey: ['studyAnalysis', studyId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/v1/study/${studyId}/analysis`);
      if (!response.ok) throw new Error('Failed to fetch study analysis data');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  // Fetch timeline data
  const timelineQuery = useQuery<TimelineData>({
    queryKey: ['studyTimeline', studyId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/statistics/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handlePhysicalChange = (event: SelectChangeEvent) => {
    setSelectedPhysical(event.target.value);
  };

  const handleOmicsChange = (event: SelectChangeEvent) => {
    setSelectedOmics(event.target.value);
  };

  const handleTaxonomicChange = (event: SelectChangeEvent) => {
    setSelectedTaxonomic(event.target.value);
  };

  const handleRankChange = (event: SelectChangeEvent) => {
    setSelectedRank(event.target.value);
  };

  if (studyAnalysisQuery.isLoading || timelineQuery.isLoading || sampleQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (studyAnalysisQuery.isError || timelineQuery.isError || sampleQuery.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {studyAnalysisQuery.error?.message || timelineQuery.error?.message || sampleQuery.error?.message || 'An error occurred'}
        </Alert>
      </Box>
    );
  }

  const renderTimeline = () => {
    if (!timelineQuery.data) return null;
    const data = timelineQuery.data;

    // Aggregate samples by date for the compendium
    const compendiumSamples = data.sample_timeline.reduce((acc: { [key: string]: number }, sample) => {
      const date = sample.date.split('T')[0]; // Get just the date part
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Aggregate samples by date for the current study
    const studySamples = data.sample_timeline
      .filter(sample => sample.study_id === studyId)
      .reduce((acc: { [key: string]: number }, sample) => {
        const date = sample.date.split('T')[0]; // Get just the date part
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    // Convert to arrays for plotting
    const compendiumDates = Object.keys(compendiumSamples).sort();
    const compendiumCounts = compendiumDates.map(date => compendiumSamples[date]);
    const studyDates = Object.keys(studySamples).sort();
    const studyCounts = studyDates.map(date => studySamples[date]);

    const plotData: Data[] = [
      {
        x: compendiumDates.map(d => new Date(d)),
        y: compendiumCounts,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'All Samples',
        line: { color: '#ccc' },
        marker: { color: '#ccc', size: 8 }
      },
      {
        x: studyDates.map(d => new Date(d)),
        y: studyCounts,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Study Samples',
        line: { color: '#1976d2' },
        marker: { color: '#1976d2', size: 10 }
      }
    ];

    if (sampleDate) {
      const sampleDateStr = sampleDate.split('T')[0];
      const sampleCount = studySamples[sampleDateStr] || 0;
      plotData.push({
        x: [new Date(sampleDate)],
        y: [sampleCount],
        type: 'scatter',
        mode: 'markers',
        name: 'Current Sample',
        marker: { 
          color: 'rgba(255, 165, 0, 0.7)', // Semi-transparent orange
          size: 15,
          line: {
            color: 'orange',
            width: 2
          }
        }
      });
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Study Timeline */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Study Timeline</Typography>
          <Box sx={{ height: 400 }}>
            <Plot
              data={data.study_timelines.map((study) => ({
                x: [new Date(study.start_date), new Date(study.end_date)],
                y: [study.study_id, study.study_id],
                type: 'scatter',
                mode: 'lines+markers',
                name: study.study_id,
                text: [`${study.sample_count} samples`, `${study.sample_count} samples`],
                hoverinfo: 'text',
                line: { 
                  width: 2,
                  color: study.study_id === studyId ? '#1976d2' : '#ccc'
                },
                showlegend: false
              }))}
              layout={{
                autosize: true,
                height: 400,
                margin: { l: 200, r: 50, t: 50, b: 50 },
                xaxis: {
                  title: 'Date',
                  type: 'date'
                },
                yaxis: {
                  title: 'Study ID',
                  type: 'category',
                  tickangle: 0,
                  automargin: true
                }
              }}
              style={{ width: '100%' }}
            />
          </Box>
        </Paper>

        {/* Sample Timeline */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Sample Timeline</Typography>
          <Box sx={{ height: 400 }}>
            <Plot
              data={plotData}
              layout={{
                autosize: true,
                height: 400,
                margin: { l: 50, r: 50, t: 50, b: 50 },
                xaxis: {
                  title: 'Date',
                  type: 'date'
                },
                yaxis: {
                  title: 'Number of Samples',
                  type: 'linear'
                },
                showlegend: true,
                legend: {
                  x: 1,
                  xanchor: 'right',
                  y: 1
                }
              }}
              style={{ width: '100%' }}
            />
          </Box>
        </Paper>
      </Box>
    );
  };

  const renderEcosystem = () => {
    if (!sampleQuery.data || !studyAnalysisQuery.data) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    const sample = sampleQuery.data;

    // Calculate ecosystem variables with their frequencies - show all variables
    const ecosystemVariables: EcosystemVariable[] = ECOSYSTEM_VARIABLES.map(key => {
        // Get the ecosystem data from the physical variables section
        const ecosystemData = sample.physical?.[key];
        
        return {
            key,
            value: ecosystemData?.value || 'No data',
            studyFraction: ecosystemData?.study_frequency || 0,
            compendiumFraction: ecosystemData?.compendium_frequency || 0
        };
    });

    return (
      <Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Variable</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="right">Study Frequency (%)</TableCell>
                <TableCell align="right">Compendium Frequency (%)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ecosystemVariables.map(({ key, value, studyFraction, compendiumFraction }) => (
                <TableRow key={key}>
                  <TableCell>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableCell>
                  <TableCell>{value}</TableCell>
                  <TableCell align="right">{studyFraction.toFixed(2)}%</TableCell>
                  <TableCell align="right">{compendiumFraction.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderPhysicalVariables = () => {
    if (!studyAnalysisQuery.data?.physical || !sampleQuery.data) {
      return null;
    }
    const data = studyAnalysisQuery.data.physical;
    const sample = sampleQuery.data;

    // Filter variables that have valid data
    const variables = Object.entries(data)
      .filter(([_, data]) => data.status === 'ok')
      .map(([name, data]) => {
        // Get the sample value from the sample data's physical section
        const sampleValue = sample.physical?.[name]?.value || data.value;
        return {
          name,
          ...data,
          sampleValue,
          mean: data.mean,
          std: data.std,
          compendium_mean: data.compendium_mean,
          compendium_std: data.compendium_std,
          p_value: data.p_value,
          effect_size: data.effect_size
        };
      });

    if (variables.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">No physical variables available for this study.</Alert>
        </Box>
      );
    }

    // Set initial selected variable if none selected or if selected variable is not available
    if (!selectedPhysical || !variables.find(v => v.name === selectedPhysical)) {
      setSelectedPhysical(variables[0].name);
    }

    const selectedVariable = variables.find(v => v.name === selectedPhysical);
    if (!selectedVariable) {
      return null;
    }

    return (
      <Box sx={{ p: 2 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Select Variable</InputLabel>
          <Select
            value={selectedPhysical}
            onChange={handlePhysicalChange}
            label="Select Variable"
          >
            {variables.map(v => (
              <MenuItem key={v.name} value={v.name}>
                {v.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedPhysical && (
          <Box sx={{ display: 'flex', gap: 2, height: 300 }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Plot
                data={[
                  {
                    x: ['Sample', 'Study', 'Compendium'],
                    y: [selectedVariable.sampleValue, selectedVariable.mean, selectedVariable.compendium_mean],
                    type: 'bar',
                    name: 'Value',
                    marker: {
                      color: ['#ff4444', '#1976d2', '#82ca9d']
                    }
                  }
                ]}
                layout={{
                  autosize: true,
                  height: 250,
                  margin: { l: 50, r: 50, t: 50, b: 50 },
                  title: selectedVariable.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                  showlegend: false
                }}
                style={{ width: '100%' }}
              />
            </Box>

            <TableContainer component={Paper} sx={{ flex: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell align="right">Sample</TableCell>
                    <TableCell align="right">Study</TableCell>
                    <TableCell align="right">Compendium</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Value</TableCell>
                    <TableCell align="right">{selectedVariable.sampleValue?.toFixed(4) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{selectedVariable.mean?.toFixed(4) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{selectedVariable.compendium_mean?.toFixed(4) ?? 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Standard Deviation</TableCell>
                    <TableCell align="right">N/A</TableCell>
                    <TableCell align="right">{selectedVariable.std?.toFixed(4) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{selectedVariable.compendium_std?.toFixed(4) ?? 'N/A'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    );
  };

  const renderOmics = () => {
    if (!studyAnalysisQuery.data?.omics?.top10 || !sampleQuery.data) return null;
    const data = studyAnalysisQuery.data.omics.top10[selectedOmics];
    const sampleData = sampleQuery.data.omics?.top10?.[selectedOmics] || [];
    
    return (
      <Box>
        <FormControl sx={{ mb: 2, minWidth: 200 }}>
          <InputLabel>Omics Type</InputLabel>
          <Select
            value={selectedOmics}
            label="Omics Type"
            onChange={handleOmicsChange}
          >
            {OMICS_TYPES.map(type => (
              <MenuItem key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {data && data.length > 0 ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Sample Abundance</TableCell>
                  <TableCell align="right">Mean Abundance</TableCell>
                  <TableCell align="right">Std Abundance</TableCell>
                  <TableCell align="right">Sample Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((item, index) => {
                  const sampleItem = sampleData.find((s: OmicsItem) => s.id === item.id);
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell align="right">{sampleItem?.abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.mean_abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.std_abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.sample_count ?? 'N/A'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No omics data available for this sample.</Alert>
        )}
      </Box>
    );
  };

  const renderTaxonomic = () => {
    if (!studyAnalysisQuery.data?.taxonomic?.top10 || !sampleQuery.data) return null;
    const data = studyAnalysisQuery.data.taxonomic.top10[selectedTaxonomic]?.[selectedRank];
    const sampleData = sampleQuery.data.taxonomic?.top10?.[selectedTaxonomic]?.[selectedRank] || [];
    
    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Analysis Type</InputLabel>
            <Select
              value={selectedTaxonomic}
              label="Analysis Type"
              onChange={handleTaxonomicChange}
            >
              {TAXONOMIC_TYPES.map(type => (
                <MenuItem key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Taxonomic Rank</InputLabel>
            <Select
              value={selectedRank}
              label="Taxonomic Rank"
              onChange={handleRankChange}
            >
              {TAXONOMIC_RANKS.map(rank => (
                <MenuItem key={rank} value={rank}>
                  {rank.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {data && data.length > 0 ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Sample Abundance</TableCell>
                  <TableCell align="right">Mean Abundance</TableCell>
                  <TableCell align="right">Std Abundance</TableCell>
                  <TableCell align="right">Sample Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((item, index) => {
                  const sampleItem = sampleData.find((s: TaxonomicItem) => s.id === item.id);
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.name || item.id}</TableCell>
                      <TableCell align="right">{sampleItem?.abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.mean_abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.std_abundance?.toFixed(4) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.sample_count ?? 'N/A'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No taxonomic data available for this sample.</Alert>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Timeline" />
          <Tab label="Ecosystem" />
          <Tab label="Physical Variables" />
          <Tab label="Omics" />
          <Tab label="Taxonomic" />
        </Tabs>
        <Tooltip title="Refresh Data">
          <IconButton 
            onClick={() => {
              studyAnalysisQuery.refetch();
              sampleQuery.refetch();
            }}
            sx={{ ml: 2 }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && renderTimeline()}
        {activeTab === 1 && renderEcosystem()}
        {activeTab === 2 && renderPhysicalVariables()}
        {activeTab === 3 && renderOmics()}
        {activeTab === 4 && renderTaxonomic()}
      </Box>
    </Box>
  );
};

export default SampleStatisticsView; 