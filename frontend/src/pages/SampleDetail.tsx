import { useParams } from 'react-router-dom';
import { Typography, Box } from '@mui/material';

const SampleDetail = () => {
  const { sampleId } = useParams();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sample Details
      </Typography>
      <Typography>
        Sample ID: {sampleId}
      </Typography>
      <Typography>
        Detailed sample information will be displayed here.
      </Typography>
    </Box>
  );
};

export default SampleDetail; 