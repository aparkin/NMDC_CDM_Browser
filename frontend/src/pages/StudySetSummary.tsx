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
import type { GridProps } from '@mui/material';

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
        const response = await axios.get('http://localhost:8000/api/studies/cards');
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
          <Grid item xs={12} sm={6} md={4} key={study.id} component="div">
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