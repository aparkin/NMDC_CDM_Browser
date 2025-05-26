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
  TableCell
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Plot from 'react-plotly.js';

interface StudyStatisticsViewProps {
  studyId: string;
}

interface StudyTimeline {
  study_id: string;
  start_date: string;
  end_date: string;
  sample_count: number;
}

interface SampleTimeline {
  sample_id: string;
  date: string;
  study_id: string;
}

interface TimelineData {
  study_timelines: StudyTimeline[];
  sample_timeline: SampleTimeline[];
}

interface PhysicalVariableData {
  status: string;
  mean: number;
  std: number;
  compendium_mean: number;
  compendium_std: number;
  p_value: number;
  effect_size: number;
}

interface OmicsItem {
  id: string;
  mean_abundance: number;
  std_abundance: number;
  sample_count: number;
  compendium_mean?: number;
  compendium_std?: number;
  p_value?: number;
  effect_size?: number;
  mean_species_count?: number;
  std_species_count?: number;
  direction?: 'higher' | 'lower';
  common_name?: string;
  iupac_name?: string;
  traditional_name?: string;
  molecular_formula?: string;
  chebi_id?: string;
  kegg_compound_id?: string;
  lipid_class?: string;
  lipid_category?: string;
  ec_number?: string;
  pfam?: string;
  ko?: string;
  cog?: string;
  gene_count?: number;
  unique_peptide_count?: number;
}

interface AnalysisData {
  physical: Record<string, PhysicalVariableData>;
  omics: {
    top10: Record<string, OmicsItem[]>;
    outliers: Record<string, OmicsItem[]>;
  };
  taxonomic: {
    top10: Record<string, Record<string, OmicsItem[]>>;
    outliers: Record<string, Record<string, OmicsItem[]>>;
  };
}

interface TableColumn {
  id: keyof OmicsItem;
  label: string;
  align?: 'left' | 'right' | 'center' | 'inherit' | 'justify';
}

const StudyStatisticsView: React.FC<StudyStatisticsViewProps> = ({ studyId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedOmicsType, setSelectedOmicsType] = useState('metabolomics');
  const [selectedTaxonomicType, setSelectedTaxonomicType] = useState('gottcha');
  const [selectedPhysicalVariable, setSelectedPhysicalVariable] = useState('');
  const [selectedRank, setSelectedRank] = useState('superkingdom');
  const [omicsTabValue, setOmicsTabValue] = useState(0);
  const [taxonomicTabValue, setTaxonomicTabValue] = useState(0);
  const [sortField, setSortField] = useState<keyof OmicsItem>('effect_size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch study analysis data
  const analysisQuery = useQuery({
    queryKey: ['studyAnalysis', studyId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/v1/study/${studyId}/analysis`);
      if (!response.ok) throw new Error('Failed to fetch study analysis');
      const data = await response.json();
      console.log('Analysis data received:', data);
      return data;
    }
  });

  // Fetch timeline data
  const timelineQuery = useQuery({
    queryKey: ['studyTimeline', studyId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:8000/api/statistics/timeline`);
      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    }
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleOmicsTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setOmicsTabValue(newValue);
  };

  const handleTaxonomicTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTaxonomicTabValue(newValue);
  };

  const handleOmicsTypeChange = (event: SelectChangeEvent) => {
    setSelectedOmicsType(event.target.value);
  };

  const handleTaxonomicTypeChange = (event: SelectChangeEvent) => {
    setSelectedTaxonomicType(event.target.value);
  };

  const handlePhysicalVariableChange = (event: SelectChangeEvent) => {
    setSelectedPhysicalVariable(event.target.value);
  };

  const handleRankChange = (event: SelectChangeEvent) => {
    setSelectedRank(event.target.value);
  };

  const handleSort = (field: keyof OmicsItem) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (analysisQuery.isLoading || timelineQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (analysisQuery.isError || timelineQuery.isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {analysisQuery.error?.message || timelineQuery.error?.message || 'An error occurred'}
        </Alert>
      </Box>
    );
  }

  const renderTimeline = () => {
    if (!timelineQuery.data) return null;
    const data = timelineQuery.data as TimelineData;

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

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Study Timeline */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Study Timeline</Typography>
          <Box sx={{ height: 400 }}>
            <Plot
              data={data.study_timelines.map((study: StudyTimeline) => ({
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
              data={[
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
              ]}
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

  const renderPhysicalVariables = () => {
    if (!analysisQuery.data?.physical) return null;
    const data = analysisQuery.data as AnalysisData;

    const variables = Object.entries(data.physical)
      .filter(([_, data]) => data.status === 'ok')
      .map(([name, data]) => ({
        name,
        ...data
      }));

    if (variables.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">No physical variables available for this study.</Alert>
        </Box>
      );
    }

    // Set initial selected variable if none selected
    if (!selectedPhysicalVariable && variables.length > 0) {
      setSelectedPhysicalVariable(variables[0].name);
    }

    const selectedVariable = variables.find(v => v.name === selectedPhysicalVariable);
    if (!selectedVariable) return null;

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Physical Variables</Typography>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Select Variable</InputLabel>
          <Select
            value={selectedPhysicalVariable}
            onChange={handlePhysicalVariableChange}
            label="Select Variable"
          >
            {variables.map(v => (
              <MenuItem key={v.name} value={v.name}>
                {v.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedPhysicalVariable && (
          <Box sx={{ height: 400 }}>
            <Plot
              data={[
                {
                  x: ['Study', 'Compendium'],
                  y: [selectedVariable.mean, selectedVariable.compendium_mean],
                  type: 'bar',
                  name: 'Mean Value',
                  marker: {
                    color: ['#1976d2', '#82ca9d']
                  }
                }
              ]}
              layout={{
                autosize: true,
                height: 400,
                margin: { l: 50, r: 50, t: 50, b: 50 },
                title: selectedVariable.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                showlegend: false
              }}
              style={{ width: '100%' }}
            />
          </Box>
        )}

        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Variable</TableCell>
                <TableCell align="right">Study Mean</TableCell>
                <TableCell align="right">Study Std</TableCell>
                <TableCell align="right">Compendium Mean</TableCell>
                <TableCell align="right">Compendium Std</TableCell>
                <TableCell align="right">P-value</TableCell>
                <TableCell align="right">Effect Size</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variables.map(v => (
                <TableRow key={v.name}>
                  <TableCell>{v.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</TableCell>
                  <TableCell align="right">{v.mean?.toFixed(6) ?? 'N/A'}</TableCell>
                  <TableCell align="right">{v.std?.toFixed(6) ?? 'N/A'}</TableCell>
                  <TableCell align="right">{v.compendium_mean?.toFixed(6) ?? 'N/A'}</TableCell>
                  <TableCell align="right">{v.compendium_std?.toFixed(6) ?? 'N/A'}</TableCell>
                  <TableCell align="right">{v.p_value?.toFixed(6) ?? 'N/A'}</TableCell>
                  <TableCell align="right">{v.effect_size?.toFixed(6) ?? 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderOmicsTable = (items: OmicsItem[], type: string) => {
    if (!items || items.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">No data available for this selection.</Alert>
        </Box>
      );
    }

    const getColumns = (): TableColumn[] => {
      switch (type) {
        case 'metabolomics':
          return [
            { id: 'id', label: 'Compound Name' },
            { id: 'common_name', label: 'Common Name' },
            { id: 'iupac_name', label: 'IUPAC Name' },
            { id: 'traditional_name', label: 'Traditional Name' },
            { id: 'molecular_formula', label: 'Molecular Formula' },
            { id: 'chebi_id', label: 'Chebi ID' },
            { id: 'kegg_compound_id', label: 'Kegg Compound ID' },
            { id: 'mean_abundance', label: 'Mean Abundance', align: 'right' },
            { id: 'std_abundance', label: 'Standard Deviation', align: 'right' }
          ];
        case 'lipidomics':
          return [
            { id: 'id', label: 'Lipid Molecular Species' },
            { id: 'lipid_class', label: 'Lipid Class' },
            { id: 'lipid_category', label: 'Lipid Category' },
            { id: 'mean_abundance', label: 'Mean Abundance', align: 'right' },
            { id: 'std_abundance', label: 'Standard Deviation', align: 'right' }
          ];
        case 'proteomics':
          return [
            { id: 'id', label: 'Product' },
            { id: 'ec_number', label: 'EC Number' },
            { id: 'pfam', label: 'Pfam' },
            { id: 'ko', label: 'KO' },
            { id: 'cog', label: 'COG' },
            { id: 'gene_count', label: 'Gene Count', align: 'right' },
            { id: 'unique_peptide_count', label: 'Unique Peptide Count', align: 'right' },
            { id: 'mean_abundance', label: 'Mean Abundance', align: 'right' },
            { id: 'std_abundance', label: 'Standard Deviation', align: 'right' }
          ];
        default:
          return [];
      }
    };

    const columns = getColumns();

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align}>
                    {(() => {
                      const value = item[column.id];
                      if (value === undefined || value === null) return 'N/A';
                      
                      switch (column.id) {
                        case 'mean_abundance':
                        case 'std_abundance':
                          return typeof value === 'number' ? value.toFixed(6) : 'N/A';
                        case 'gene_count':
                        case 'unique_peptide_count':
                          return typeof value === 'number' ? value.toString() : 'N/A';
                        default:
                          return value.toString();
                      }
                    })()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderOmics = () => {
    if (!analysisQuery.data?.omics) {
      console.log('No omics data available:', analysisQuery.data);
      return null;
    }
    const data = analysisQuery.data as AnalysisData;
    console.log('Raw omics data:', data.omics);

    return (
      <Box sx={{ p: 2 }}>
        <Tabs value={omicsTabValue} onChange={handleOmicsTabChange}>
          <Tab label="Top 10" />
          <Tab label="Outliers" />
        </Tabs>

        <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Select Omics Type</InputLabel>
            <Select
              value={selectedOmicsType}
              onChange={handleOmicsTypeChange}
              label="Select Omics Type"
            >
              <MenuItem value="metabolomics">Metabolomics</MenuItem>
              <MenuItem value="lipidomics">Lipidomics</MenuItem>
              <MenuItem value="proteomics">Proteomics</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {omicsTabValue === 0 ? (
          // Top 10 Tab
          renderOmicsTable(data.omics.top10[selectedOmicsType] || [], selectedOmicsType)
        ) : (
          // Outliers Tab
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell align="right">Study Mean</TableCell>
                  <TableCell align="right">Study Std</TableCell>
                  <TableCell align="right">Compendium Mean</TableCell>
                  <TableCell align="right">Compendium Std</TableCell>
                  <TableCell align="right">P-value</TableCell>
                  <TableCell align="right">Effect Size</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.omics.outliers[selectedOmicsType] || []).map((item: OmicsItem) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell align="right">{item.mean_abundance?.toFixed(6) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{item.std_abundance?.toFixed(6) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{item.compendium_mean?.toFixed(6) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{item.compendium_std?.toFixed(6) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{item.p_value?.toFixed(6) ?? 'N/A'}</TableCell>
                    <TableCell align="right">{item.effect_size?.toFixed(6) ?? 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  };

  const renderTaxonomic = () => {
    if (!analysisQuery.data?.taxonomic) {
      console.log('No taxonomic data available:', analysisQuery.data);
      return null;
    }
    const data = analysisQuery.data as AnalysisData;
    console.log('Raw taxonomic data:', data.taxonomic);

    const top10Items = data.taxonomic.top10[selectedTaxonomicType]?.[selectedRank] || [];
    const outlierItems = data.taxonomic.outliers[selectedTaxonomicType]?.[selectedRank] || [];
    
    // Sort outliers if we have items
    const sortedOutliers = outlierItems.length > 0 ? [...outlierItems].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    }) : [];
    
    console.log('Selected taxonomic type:', selectedTaxonomicType);
    console.log('Selected rank:', selectedRank);
    console.log('Sorted outliers:', sortedOutliers);

    return (
      <Box sx={{ p: 2 }}>
        <Tabs value={taxonomicTabValue} onChange={handleTaxonomicTabChange}>
          <Tab label="Top 10" />
          <Tab label="Outliers" />
        </Tabs>

        <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Select Taxonomic Type</InputLabel>
            <Select
              value={selectedTaxonomicType}
              onChange={handleTaxonomicTypeChange}
              label="Select Taxonomic Type"
            >
              <MenuItem value="gottcha">GOTTCHA</MenuItem>
              <MenuItem value="kraken">Kraken</MenuItem>
              <MenuItem value="centrifuge">Centrifuge</MenuItem>
              <MenuItem value="contigs">Contigs</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Select Rank</InputLabel>
            <Select
              value={selectedRank}
              onChange={handleRankChange}
              label="Select Rank"
            >
              <MenuItem value="superkingdom">Superkingdom</MenuItem>
              <MenuItem value="phylum">Phylum</MenuItem>
              <MenuItem value="class">Class</MenuItem>
              <MenuItem value="order">Order</MenuItem>
              <MenuItem value="family">Family</MenuItem>
              <MenuItem value="genus">Genus</MenuItem>
              <MenuItem value="species">Species</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {taxonomicTabValue === 0 ? (
          // Top 10 Tab
          top10Items.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell align="right">Mean Abundance</TableCell>
                    <TableCell align="right">Std Abundance</TableCell>
                    <TableCell align="right">Sample Count</TableCell>
                    <TableCell align="right">Mean Species Count</TableCell>
                    <TableCell align="right">Std Dev Species Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {top10Items.map((item: OmicsItem) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell align="right">{item.mean_abundance?.toFixed(6) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.std_abundance?.toFixed(6) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.sample_count ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.mean_species_count?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.std_species_count?.toFixed(2) ?? 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No top 10 data available for {selectedTaxonomicType} at {selectedRank} rank.
            </Alert>
          )
        ) : (
          // Outliers Tab
          sortedOutliers.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell 
                      align="right" 
                      onClick={() => handleSort('effect_size')}
                      sx={{ cursor: 'pointer' }}
                    >
                      Effect Size {sortField === 'effect_size' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell 
                      align="right"
                      onClick={() => handleSort('p_value')}
                      sx={{ cursor: 'pointer' }}
                    >
                      P-value {sortField === 'p_value' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right">Direction</TableCell>
                    <TableCell 
                      align="right"
                      onClick={() => handleSort('mean_abundance')}
                      sx={{ cursor: 'pointer' }}
                    >
                      Study Mean {sortField === 'mean_abundance' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableCell>
                    <TableCell align="right">Study Std</TableCell>
                    <TableCell align="right">Compendium Mean</TableCell>
                    <TableCell align="right">Compendium Std</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedOutliers.map((item: OmicsItem) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell align="right">{item.effect_size?.toFixed(6) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.p_value?.toFixed(6) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.direction ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.mean_abundance.toFixed(6)}</TableCell>
                      <TableCell align="right">{item.std_abundance.toFixed(6)}</TableCell>
                      <TableCell align="right">{item.compendium_mean?.toFixed(6) ?? 'N/A'}</TableCell>
                      <TableCell align="right">{item.compendium_std?.toFixed(6) ?? 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No outlier data available for {selectedTaxonomicType} at {selectedRank} rank.
            </Alert>
          )
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label="Timeline" />
        <Tab label="Physical Variables" />
        <Tab label="Omics" />
        <Tab label="Taxonomic" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && renderTimeline()}
        {activeTab === 1 && renderPhysicalVariables()}
        {activeTab === 2 && renderOmics()}
        {activeTab === 3 && renderTaxonomic()}
      </Box>
    </Box>
  );
};

export default StudyStatisticsView; 