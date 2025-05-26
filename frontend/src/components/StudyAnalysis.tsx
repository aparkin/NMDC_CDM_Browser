import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StudyAnalysisProps {
  studyId: string;
}

interface AnalysisData {
  physical: {
    [key: string]: {
      status: string;
      mean: number;
      std: number;
      min: number;
      max: number;
      count: number;
      compendium_mean: number;
      compendium_std: number;
      p_value: number;
      significant: boolean;
      effect_size: number;
    };
  };
  omics: {
    top10: {
      [key: string]: Array<{
        id: string;
        mean_abundance: number;
        std_abundance: number;
        sample_count: number;
      }>;
    };
    outliers: {
      [key: string]: Array<{
        id: string;
        mean_abundance: number;
        std_abundance: number;
        sample_count: number;
        compendium_mean: number;
        compendium_std: number;
        p_value: number;
        effect_size: number;
        direction: string;
      }>;
    };
  };
  taxonomic: {
    top10: {
      [key: string]: Array<{
        id: string;
        mean_abundance: number;
        std_abundance: number;
        sample_count: number;
      }>;
    };
    outliers: {
      [key: string]: Array<{
        id: string;
        mean_abundance: number;
        std_abundance: number;
        sample_count: number;
        compendium_mean: number;
        compendium_std: number;
        p_value: number;
        effect_size: number;
        direction: string;
      }>;
    };
  };
}

const StudyAnalysis: React.FC<StudyAnalysisProps> = ({ studyId }) => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/study/${studyId}/analysis`);
        if (!response.ok) {
          throw new Error('Failed to fetch study analysis');
        }
        const data = await response.json();
        setAnalysis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [studyId]);

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
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!analysis) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>No analysis data available</Typography>
      </Box>
    );
  }

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const renderPhysicalVariables = () => {
    const significantVars = Object.entries(analysis.physical)
      .filter(([_, data]) => data.status === 'ok' && data.significant)
      .map(([name, data]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        studyMean: data.mean,
        compendiumMean: data.compendium_mean,
        effectSize: data.effect_size,
      }));

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Physical Variables Analysis
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={significantVars}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="studyMean" name="Study Mean" fill="#8884d8" />
            <Bar dataKey="compendiumMean" name="Compendium Mean" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderOmicsData = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Omics Analysis
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(analysis.omics.top10).map(([type, data]) => (
            <Box component="div" key={type} sx={{ width: '100%', p: 1 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {type.charAt(0).toUpperCase() + type.slice(1)} Top 10
                </Typography>
                {data.map((item, index) => (
                  <Box key={item.id} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {index + 1}. {item.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Mean: {item.mean_abundance.toFixed(2)} ± {item.std_abundance.toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Box>
          ))}
        </Grid>
      </Box>
    );
  };

  const renderTaxonomicData = () => {
    if (!analysis?.taxonomic) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography color="error">No taxonomic data available</Typography>
        </Box>
      );
    }

    const taxonomicTypes = ['gottcha', 'kraken', 'centrifuge', 'contigs'];

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Taxonomic Analysis
        </Typography>
        <Grid container spacing={2}>
          {taxonomicTypes.map((type) => {
            const top10Data = analysis.taxonomic.top10[type] || [];
            const outliersData = analysis.taxonomic.outliers[type] || [];

            return (
              <Box key={type} sx={{ width: '100%', mb: 2 }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Typography>
                  
                  {/* Top 10 Section */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Top 10 Abundant Taxa
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Taxon</TableCell>
                            <TableCell align="right">Mean Abundance</TableCell>
                            <TableCell align="right">Std Dev</TableCell>
                            <TableCell align="right">Sample Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {top10Data.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.id}</TableCell>
                              <TableCell align="right">{item.mean_abundance.toFixed(4)}</TableCell>
                              <TableCell align="right">{item.std_abundance?.toFixed(4) || 'N/A'}</TableCell>
                              <TableCell align="right">{item.sample_count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Outliers Section */}
                  {outliersData.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Significant Outliers
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Taxon</TableCell>
                              <TableCell align="right">Study Mean</TableCell>
                              <TableCell align="right">Study Std</TableCell>
                              <TableCell align="right">Compendium Mean</TableCell>
                              <TableCell align="right">Compendium Std</TableCell>
                              <TableCell align="right">P-value</TableCell>
                              <TableCell align="right">Effect Size</TableCell>
                              <TableCell align="right">Direction</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {outliersData.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell align="right">{item.mean_abundance.toFixed(4)}</TableCell>
                                <TableCell align="right">{item.std_abundance.toFixed(4)}</TableCell>
                                <TableCell align="right">{item.compendium_mean.toFixed(4)}</TableCell>
                                <TableCell align="right">{item.compendium_std.toFixed(4)}</TableCell>
                                <TableCell align="right">{item.p_value.toFixed(4)}</TableCell>
                                <TableCell align="right">{item.effect_size.toFixed(2)}</TableCell>
                                <TableCell align="right">{item.direction}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Paper>
              </Box>
            );
          })}
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Physical Variables" />
        <Tab label="Omics" />
        <Tab label="Taxonomic" />
      </Tabs>
      <Divider />
      {activeTab === 0 && renderPhysicalVariables()}
      {activeTab === 1 && renderOmicsData()}
      {activeTab === 2 && renderTaxonomicData()}
    </Box>
  );
};

export default StudyAnalysis; 