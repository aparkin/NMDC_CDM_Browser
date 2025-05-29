import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import axios from 'axios';
import { API_ENDPOINTS } from '@/config/api';

interface Study {
  id: string;
  name: string;
  description: string;
  sample_count: number;
  measurement_types: string[];
}

const StudySetSummary = () => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudies = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.studies.list());
        setStudies(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch studies');
        setLoading(false);
      }
    };

    fetchStudies();
  }, []);

  const filteredStudies = studies.filter((study) =>
    study.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          NMDC Studies
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search studies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        <Typography variant="subtitle1" color="text.secondary">
          {filteredStudies.length} studies found
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {filteredStudies.map((study) => (
          <Grid key={study.id} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {study.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {study.description}
                </Typography>
                <Typography variant="body2">
                  Samples: {study.sample_count}
                </Typography>
                <Typography variant="body2">
                  Measurements: {study.measurement_types.join(', ')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default StudySetSummary; 