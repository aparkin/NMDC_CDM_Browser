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
  IconButton,
  Tooltip,
  Alert,
  Button,
  CircularProgress,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';
import { BarChart, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, ResponsiveContainer } from 'recharts';
import Plot from 'react-plotly.js';

// Types for our data
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

interface EcosystemData {
  variable: string;
  value_counts: Record<string, number>;
  total_samples: number;
  unique_values: number;
  error?: string;
}

interface PhysicalVariableData {
  variable: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
  histogram: {
    values: number[];
    bin_edges: number[];
  };
  error?: string;
}

interface OmicsData {
  compound_name?: string;  // For metabolomics
  lipid_molecular_species?: string;  // For lipidomics
  product?: string;  // For proteomics
  mean_abundance: number;
  std_abundance: number;
  // Additional fields
  common_name?: string;  // For metabolomics
  molecular_formula?: string;  // For metabolomics
  lipid_class?: string;  // For lipidomics
  lipid_category?: string;  // For lipidomics
  gene_count?: number;  // For proteomics
  unique_peptide_count?: number;  // For proteomics
  ec_number?: string;  // For proteomics
  pfam?: string;  // For proteomics
  ko?: string;  // For proteomics
  cog?: string;  // For proteomics
  iupac_name?: string;  // For metabolomics
  traditional_name?: string;  // For metabolomics
  chebi_id?: string;  // For metabolomics
  kegg_id?: string;  // For metabolomics
}

interface TaxonomicData {
  [rank: string]: Array<{
    rank: string;
    lineage: string;
    mean_abundance: number;
    std_abundance: number;
    // Additional fields for specific analysis types
    mean_species_count?: number;
    std_species_count?: number;
    mean_read_count?: number;
    std_read_count?: number;
    label?: string;
    name?: string;
  }>;
}

// Constants for dropdowns
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
  'ammonium_nitrogen_numeric',
  'calcium_numeric',
  'carb_nitro_ratio',
  'chlorophyll_has_numeric_value',
  'conduc_has_numeric_value',
  'depth',
  'diss_inorg_carb_has_numeric_value',
  'diss_inorg_nitro_has_numeric_value',
  'diss_iron_has_numeric_value',
  'diss_org_carb_has_numeric_value',
  'diss_oxygen_has_numeric_value',
  'host_age_numeric',
  'magnesium_numeric',
  'manganese_numeric',
  'nitrate_nitrogen_numeric',
  'nitrite_nitrogen_numeric',
  'org_carb_has_numeric_value',
  'potassium_numeric',
  'samp_size_numeric',
  'sodium_has_numeric_value',
  'soluble_react_phosp_has_numeric_value',
  'sulfate_has_numeric_value',
  'temp_has_numeric_value',
  'tot_nitro_numeric',
  'tot_org_carb',
  'tot_phosp_numeric',
  'water_content_numeric',
  'zinc_numeric',
  'abs_air_humidity',
  'avg_temp',
  'gravidity',
  'humidity',
  'latitude',
  'longitude',
  'ph',
  'photon_flux',
  'solar_irradiance',
  'tot_carb',
  'wind_speed'
];

const OMICS_TYPES = [
  'metabolomics',
  'lipidomics',
  'proteomics'
];

const TAXONOMIC_TYPES = [
  'contigs',
  'centrifuge',
  'kraken',
  'gottcha'
];

// Add these constants
const TAXONOMIC_RANKS = [
  'superkingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species'
];

// Tooltip descriptions
const ECOSYSTEM_TOOLTIPS: Record<string, string> = {
  ecosystem: "The primary ecosystem classification of the sample",
  ecosystem_category: "Broad category of the ecosystem",
  ecosystem_subtype: "Specific subtype within the ecosystem category",
  ecosystem_type: "Detailed type classification of the ecosystem",
  env_broad_scale_label: "Large-scale environmental context",
  env_local_scale_label: "Local environmental context",
  specific_ecosystem: "Specific ecosystem identifier",
  env_medium_label: "Environmental medium (e.g., soil, water)",
  soil_horizon: "Soil layer classification",
  soil_type: "Type of soil present"
};

const PHYSICAL_TOOLTIPS: Record<string, string> = {
  ammonium_nitrogen_numeric: "Ammonium nitrogen concentration",
  calcium_numeric: "Calcium concentration",
  carb_nitro_ratio: "Carbon to nitrogen ratio",
  chlorophyll_has_numeric_value: "Chlorophyll presence",
  conduc_has_numeric_value: "Conductivity measurements",
  depth: "Sample collection depth",
  diss_inorg_carb_has_numeric_value: "Dissolved inorganic carbon",
  diss_inorg_nitro_has_numeric_value: "Dissolved inorganic nitrogen",
  diss_iron_has_numeric_value: "Dissolved iron concentration",
  diss_org_carb_has_numeric_value: "Dissolved organic carbon",
  diss_oxygen_has_numeric_value: "Dissolved oxygen levels",
  host_age_numeric: "Host organism age",
  magnesium_numeric: "Magnesium concentration",
  manganese_numeric: "Manganese concentration",
  nitrate_nitrogen_numeric: "Nitrate nitrogen concentration",
  nitrite_nitrogen_numeric: "Nitrite nitrogen concentration",
  org_carb_has_numeric_value: "Organic carbon content",
  potassium_numeric: "Potassium concentration",
  samp_size_numeric: "Sample size measurements",
  sodium_has_numeric_value: "Sodium concentration",
  soluble_react_phosp_has_numeric_value: "Soluble reactive phosphorus",
  sulfate_has_numeric_value: "Sulfate concentration",
  temp_has_numeric_value: "Temperature measurements",
  tot_nitro_numeric: "Total nitrogen content",
  tot_org_carb: "Total organic carbon",
  tot_phosp_numeric: "Total phosphorus content",
  water_content_numeric: "Water content measurements",
  zinc_numeric: "Zinc concentration",
  abs_air_humidity: "Absolute air humidity",
  avg_temp: "Average temperature",
  gravidity: "Gravidity measurements",
  humidity: "Humidity levels",
  latitude: "Geographic latitude",
  longitude: "Geographic longitude",
  ph: "pH level",
  photon_flux: "Photon flux measurements",
  solar_irradiance: "Solar irradiance levels",
  tot_carb: "Total carbon content",
  wind_speed: "Wind speed measurements"
};

const OMICS_TOOLTIPS: Record<string, string> = {
  metabolomics: "Analysis of small molecule metabolites",
  lipidomics: "Analysis of lipid molecules",
  proteomics: "Analysis of protein expression"
};

const TAXONOMIC_TOOLTIPS: Record<string, string> = {
  contigs: "Analysis based on assembled contigs",
  centrifuge: "Analysis using Centrifuge classification",
  kraken: "Analysis using Kraken classification",
  gottcha: "Analysis using GOTTCHA classification"
};

const StatisticsView: React.FC = () => {
  // State for active tab and selected variables
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEcosystem, setSelectedEcosystem] = useState<string>(ECOSYSTEM_VARIABLES[0]);
  const [selectedPhysical, setSelectedPhysical] = useState<string>(PHYSICAL_VARIABLES[0]);
  const [selectedOmics, setSelectedOmics] = useState<string>(OMICS_TYPES[0]);
  const [selectedTaxonomic, setSelectedTaxonomic] = useState<string>(TAXONOMIC_TYPES[0]);
  const [selectedRank, setSelectedRank] = useState<string>('superkingdom');

  // Queries with enhanced error handling
  const timelineQuery = useQuery<TimelineData>({
    queryKey: ['timeline'],
    queryFn: () => fetch('http://localhost:8000/api/statistics/timeline').then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    }),
    retry: (failureCount, error) => {
      if (failureCount < 3 && (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('500'))
      )) {
        return true;
      }
      return false;
    }
  });

  const ecosystemQuery = useQuery<EcosystemData>({
    queryKey: ['ecosystem', selectedEcosystem],
    queryFn: () => fetch(`http://localhost:8000/api/statistics/ecosystem/${selectedEcosystem}`).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    }),
    enabled: !!selectedEcosystem && ECOSYSTEM_VARIABLES.includes(selectedEcosystem),
    retry: (failureCount, error) => {
      if (failureCount < 3 && (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('500'))
      )) {
        return true;
      }
      return false;
    }
  });

  const physicalQuery = useQuery<PhysicalVariableData>({
    queryKey: ['physical', selectedPhysical],
    queryFn: () => {
      console.log('Fetching physical data for:', selectedPhysical);
      return fetch(`http://localhost:8000/api/statistics/physical/${selectedPhysical}`).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });
    },
    enabled: !!selectedPhysical && PHYSICAL_VARIABLES.includes(selectedPhysical),
    retry: (failureCount, error) => {
      if (failureCount < 3 && (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('500'))
      )) {
        return true;
      }
      return false;
    }
  });

  const omicsQuery = useQuery<OmicsData[]>({
    queryKey: ['omics', selectedOmics],
    queryFn: () => {
      console.log('Fetching omics data for:', selectedOmics);
      return fetch(`http://localhost:8000/api/statistics/omics/${selectedOmics}`).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });
    },
    retry: (failureCount, error) => {
      if (failureCount < 3 && (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('500'))
      )) {
        return true;
      }
      return false;
    }
  });

  const taxonomicQuery = useQuery<TaxonomicData>({
    queryKey: ['taxonomic', selectedTaxonomic],
    queryFn: () => {
      console.log('Fetching taxonomic data for:', selectedTaxonomic);
      return fetch(`http://localhost:8000/api/statistics/taxonomic/${selectedTaxonomic}`).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });
    },
    retry: (failureCount, error) => {
      if (failureCount < 3 && (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('500'))
      )) {
        return true;
      }
      return false;
    }
  });

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handler functions for dropdown changes
  const handleEcosystemChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    console.log('Ecosystem change event:', {
      value,
      isValid: ECOSYSTEM_VARIABLES.includes(value),
      currentState: selectedEcosystem,
      availableOptions: ECOSYSTEM_VARIABLES
    });
    if (value && ECOSYSTEM_VARIABLES.includes(value)) {
      setSelectedEcosystem(value);
    } else {
      console.warn('Invalid ecosystem variable selected:', value);
    }
  };

  const handlePhysicalChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value && PHYSICAL_VARIABLES.includes(value)) {
      setSelectedPhysical(value);
    }
  };

  const handleOmicsChange = (event: SelectChangeEvent<string>) => {
    setSelectedOmics(event.target.value);
  };

  const handleTaxonomicChange = (event: SelectChangeEvent<string>) => {
    setSelectedTaxonomic(event.target.value);
  };

  const renderError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {errorMessage}
        <Button 
          size="small" 
          onClick={() => {
            if (activeTab === 0) timelineQuery.refetch();
            else if (activeTab === 1) ecosystemQuery.refetch();
            else if (activeTab === 2) physicalQuery.refetch();
            else if (activeTab === 3) omicsQuery.refetch();
            else if (activeTab === 4) taxonomicQuery.refetch();
          }}
          sx={{ ml: 2 }}
        >
          Retry
        </Button>
      </Alert>
    );
  };

  // Add effect to monitor state changes
  React.useEffect(() => {
    console.log('Ecosystem state updated:', {
      selectedEcosystem,
      isValid: ECOSYSTEM_VARIABLES.includes(selectedEcosystem)
    });
  }, [selectedEcosystem]);

  React.useEffect(() => {
    console.log('Physical state updated:', {
      selectedPhysical,
      isValid: PHYSICAL_VARIABLES.includes(selectedPhysical)
    });
  }, [selectedPhysical]);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Paper sx={{ width: '100%', mb: 1 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: '40px' }}
          >
            <Tab label="Timeline" sx={{ minHeight: '40px' }} />
            <Tab label="Ecosystem" sx={{ minHeight: '40px' }} />
            <Tab label="Physical" sx={{ minHeight: '40px' }} />
            <Tab label="Omics" sx={{ minHeight: '40px' }} />
            <Tab label="Taxonomic" sx={{ minHeight: '40px' }} />
          </Tabs>
        </Paper>

        {/* Tab Panels */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 1, width: '100%' }}>
          {/* Timeline Panel */}
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Timeline Data</Typography>
                <Tooltip title="Refresh timeline data">
                  <IconButton onClick={() => timelineQuery.refetch()} size="small" sx={{ ml: 1 }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {timelineQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {timelineQuery.error && renderError(timelineQuery.error)}
              {timelineQuery.data && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Study Timeline */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Study Timeline</Typography>
                    <Box sx={{ height: 400 }}>
                      <Plot
                        data={timelineQuery.data.study_timelines.map(study => ({
                          x: [new Date(study.start_date), new Date(study.end_date)],
                          y: [study.study_id, study.study_id],
                          type: 'scatter',
                          mode: 'lines+markers',
                          name: study.study_id,
                          text: [`${study.sample_count} samples`, `${study.sample_count} samples`],
                          hoverinfo: 'text',
                          line: { width: 2 },
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
                    <Typography variant="h6" gutterBottom>Sample Collection Timeline</Typography>
                    <Box sx={{ height: 400 }}>
                      <Plot
                        data={[{
                          x: timelineQuery.data.sample_timeline.map(sample => new Date(sample.date)),
                          type: 'histogram',
                          name: 'Sample Count',
                          marker: { color: '#82ca9d' }
                        }]}
                        layout={{
                          autosize: true,
                          height: 400,
                          margin: { l: 50, r: 50, t: 50, b: 50 },
                          xaxis: {
                            title: 'Date',
                            type: 'date'
                          },
                          yaxis: {
                            title: 'Sample Count'
                          }
                        }}
                        style={{ width: '100%' }}
                      />
                    </Box>
                  </Paper>
                </Box>
              )}
            </Box>
          )}

          {/* Ecosystem Panel */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="ecosystem-select-label">Ecosystem Variable</InputLabel>
                  <Select
                    labelId="ecosystem-select-label"
                    id="ecosystem-select"
                    value={selectedEcosystem || ''}
                    label="Ecosystem Variable"
                    onChange={handleEcosystemChange}
                    displayEmpty
                  >
                    {ECOSYSTEM_VARIABLES.map((variable) => (
                      <MenuItem key={variable} value={variable}>
                        <Tooltip 
                          title={ECOSYSTEM_TOOLTIPS[variable]}
                          placement="right"
                        >
                          <span>
                            {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </Tooltip>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh ecosystem data">
                  <IconButton onClick={() => ecosystemQuery.refetch()} size="small" sx={{ ml: 1 }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {ecosystemQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {ecosystemQuery.error && renderError(ecosystemQuery.error)}
              {ecosystemQuery.data && (
                <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                  {ecosystemQuery.data.error ? (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {ecosystemQuery.data.error}
                    </Alert>
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Samples: {ecosystemQuery.data.total_samples}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        Unique Values: {ecosystemQuery.data.unique_values}
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Value</TableCell>
                              <TableCell align="right">Count</TableCell>
                              <TableCell align="right">Percentage</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(ecosystemQuery.data.value_counts)
                              .sort(([,a], [,b]) => b - a)
                              .map(([value, count]) => (
                                <TableRow key={value}>
                                  <TableCell>{value}</TableCell>
                                  <TableCell align="right">{count}</TableCell>
                                  <TableCell align="right">
                                    {((count / ecosystemQuery.data.total_samples) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Physical Variables Panel */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="physical-select-label">Physical Variable</InputLabel>
                  <Select
                    labelId="physical-select-label"
                    id="physical-select"
                    value={selectedPhysical || ''}
                    label="Physical Variable"
                    onChange={handlePhysicalChange}
                    displayEmpty
                  >
                    {PHYSICAL_VARIABLES.map((variable) => (
                      <MenuItem key={variable} value={variable}>
                        <Tooltip 
                          title={PHYSICAL_TOOLTIPS[variable]}
                          placement="right"
                        >
                          <span>
                            {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </Tooltip>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh physical variable data">
                  <IconButton onClick={() => physicalQuery.refetch()} size="small" sx={{ ml: 1 }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {physicalQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {physicalQuery.error && renderError(physicalQuery.error)}
              {physicalQuery.data && (
                <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                  {physicalQuery.data.error ? (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {physicalQuery.data.error}
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {selectedPhysical.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Statistics
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell>Sample Count</TableCell>
                                <TableCell align="right">{physicalQuery.data.count}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Mean</TableCell>
                                <TableCell align="right">{physicalQuery.data.mean.toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Standard Deviation</TableCell>
                                <TableCell align="right">{physicalQuery.data.std.toFixed(2)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Range</TableCell>
                                <TableCell align="right">
                                  {physicalQuery.data.min.toFixed(2)} - {physicalQuery.data.max.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                      <Box sx={{ flex: 2 }}>
                        <Typography variant="h6" gutterBottom>
                          Distribution
                        </Typography>
                        <Box sx={{ height: 250 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={physicalQuery.data.histogram.values.map((value, index) => ({
                                value,
                                range: `${physicalQuery.data.histogram.bin_edges[index].toFixed(2)} - ${physicalQuery.data.histogram.bin_edges[index + 1].toFixed(2)}`
                              }))}
                            >
                              <XAxis dataKey="range" />
                              <YAxis />
                              <RechartsTooltip />
                              <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Omics Panel */}
          {activeTab === 3 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="omics-select-label">Omics Type</InputLabel>
                  <Select
                    labelId="omics-select-label"
                    id="omics-select"
                    value={selectedOmics || ''}
                    label="Omics Type"
                    onChange={handleOmicsChange}
                    displayEmpty
                  >
                    {OMICS_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Tooltip 
                          title={OMICS_TOOLTIPS[type]}
                          placement="right"
                        >
                          <span>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </span>
                        </Tooltip>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh omics data">
                  <IconButton onClick={() => omicsQuery.refetch()} size="small" sx={{ ml: 1 }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {omicsQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {omicsQuery.error && renderError(omicsQuery.error)}
              {omicsQuery.data && (
                <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {selectedOmics.charAt(0).toUpperCase() + selectedOmics.slice(1)} Abundance
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>
                              {selectedOmics === 'metabolomics' ? 'Compound Name' :
                               selectedOmics === 'lipidomics' ? 'Lipid Molecular Species' :
                               'Product'}
                            </TableCell>
                            {selectedOmics === 'metabolomics' && (
                              <>
                                <TableCell>Common Name</TableCell>
                                <TableCell>IUPAC Name</TableCell>
                                <TableCell>Traditional Name</TableCell>
                                <TableCell>Molecular Formula</TableCell>
                                <TableCell>Chebi ID</TableCell>
                                <TableCell>Kegg Compound ID</TableCell>
                              </>
                            )}
                            {selectedOmics === 'lipidomics' && (
                              <>
                                <TableCell>Lipid Class</TableCell>
                                <TableCell>Lipid Category</TableCell>
                              </>
                            )}
                            {selectedOmics === 'proteomics' && (
                              <>
                                <TableCell>EC Number</TableCell>
                                <TableCell>Pfam</TableCell>
                                <TableCell>KO</TableCell>
                                <TableCell>COG</TableCell>
                                <TableCell>Gene Count</TableCell>
                                <TableCell>Unique Peptide Count</TableCell>
                              </>
                            )}
                            <TableCell align="right">Mean Abundance</TableCell>
                            <TableCell align="right">Standard Deviation</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {omicsQuery.data
                            .filter(item => item && typeof item.mean_abundance === 'number' && !isNaN(item.mean_abundance))
                            .sort((a, b) => b.mean_abundance - a.mean_abundance)
                            .map((item, index) => (
                              <TableRow key={`${item.compound_name || item.lipid_molecular_species || item.product || 'unknown'}-${index}`}>
                                <TableCell>
                                  {selectedOmics === 'metabolomics' ? item.compound_name :
                                   selectedOmics === 'lipidomics' ? item.lipid_molecular_species :
                                   item.product || 'Unnamed'}
                                </TableCell>
                                {selectedOmics === 'metabolomics' && (
                                  <>
                                    <TableCell>{item.common_name || ''}</TableCell>
                                    <TableCell>{item.iupac_name || ''}</TableCell>
                                    <TableCell>{item.traditional_name || ''}</TableCell>
                                    <TableCell>{item.molecular_formula || ''}</TableCell>
                                    <TableCell>{item.chebi_id || ''}</TableCell>
                                    <TableCell>{item.kegg_id || ''}</TableCell>
                                  </>
                                )}
                                {selectedOmics === 'lipidomics' && (
                                  <>
                                    <TableCell>{item.lipid_class || ''}</TableCell>
                                    <TableCell>{item.lipid_category || ''}</TableCell>
                                  </>
                                )}
                                {selectedOmics === 'proteomics' && (
                                  <>
                                    <TableCell>{item.ec_number || ''}</TableCell>
                                    <TableCell>{item.pfam || ''}</TableCell>
                                    <TableCell>{item.ko || ''}</TableCell>
                                    <TableCell>{item.cog || ''}</TableCell>
                                    <TableCell>{item.gene_count || ''}</TableCell>
                                    <TableCell>{item.unique_peptide_count || ''}</TableCell>
                                  </>
                                )}
                                <TableCell align="right">{item.mean_abundance?.toFixed(2) || 'N/A'}</TableCell>
                                <TableCell align="right">{item.std_abundance?.toFixed(2) || 'N/A'}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}
            </Box>
          )}

          {/* Taxonomic Panel */}
          {activeTab === 4 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="taxonomic-select-label">Taxonomic Analysis</InputLabel>
                  <Select
                    labelId="taxonomic-select-label"
                    id="taxonomic-select"
                    value={selectedTaxonomic || ''}
                    label="Taxonomic Analysis"
                    onChange={handleTaxonomicChange}
                    displayEmpty
                  >
                    {TAXONOMIC_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Tooltip 
                          title={TAXONOMIC_TOOLTIPS[type]}
                          placement="right"
                        >
                          <span>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </span>
                        </Tooltip>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="rank-select-label">Taxonomic Rank</InputLabel>
                  <Select
                    labelId="rank-select-label"
                    id="rank-select"
                    value={selectedRank || ''}
                    label="Taxonomic Rank"
                    onChange={(e) => setSelectedRank(e.target.value)}
                    displayEmpty
                  >
                    {TAXONOMIC_RANKS.map((rank) => (
                      <MenuItem key={rank} value={rank}>
                        {rank.charAt(0).toUpperCase() + rank.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Refresh taxonomic data">
                  <IconButton onClick={() => taxonomicQuery.refetch()} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {taxonomicQuery.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {taxonomicQuery.error && renderError(taxonomicQuery.error)}
              {taxonomicQuery.data && selectedRank && (
                <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Taxonomic Abundance by {selectedRank.charAt(0).toUpperCase() + selectedRank.slice(1)}
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {selectedTaxonomic !== 'gottcha' && (
                              <TableCell>Lineage</TableCell>
                            )}
                            {selectedTaxonomic === 'contigs' && (
                              <>
                                <TableCell align="right">Mean Species Count</TableCell>
                                <TableCell align="right">Std Dev Species Count</TableCell>
                              </>
                            )}
                            {selectedTaxonomic === 'centrifuge' && (
                              <>
                                <TableCell align="right">Mean Species Count</TableCell>
                                <TableCell align="right">Std Dev Species Count</TableCell>
                              </>
                            )}
                            {selectedTaxonomic === 'gottcha' && (
                              <TableCell>Label</TableCell>
                            )}
                            <TableCell align="right">Mean Abundance</TableCell>
                            <TableCell align="right">Standard Deviation</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {taxonomicQuery.data[selectedRank]
                            ?.sort((a, b) => b.mean_abundance - a.mean_abundance)
                            .map((item) => (
                              <TableRow key={selectedTaxonomic === 'gottcha' ? item.label : item.lineage}>
                                {selectedTaxonomic !== 'gottcha' && (
                                  <TableCell>{item.lineage}</TableCell>
                                )}
                                {selectedTaxonomic === 'contigs' && (
                                  <>
                                    <TableCell align="right">{item.mean_species_count?.toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.std_species_count?.toFixed(2)}</TableCell>
                                  </>
                                )}
                                {selectedTaxonomic === 'centrifuge' && (
                                  <>
                                    <TableCell align="right">{item.mean_species_count?.toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.std_species_count?.toFixed(2)}</TableCell>
                                  </>
                                )}
                                {selectedTaxonomic === 'gottcha' && (
                                  <TableCell>{item.label}</TableCell>
                                )}
                                <TableCell align="right">{item.mean_abundance.toFixed(2)}</TableCell>
                                <TableCell align="right">{item.std_abundance.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default StatisticsView; 