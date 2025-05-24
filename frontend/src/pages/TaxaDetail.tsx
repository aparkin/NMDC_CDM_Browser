import { useParams } from 'react-router-dom';
import { Typography, Box } from '@mui/material';

const TaxaDetail = () => {
  const { taxaId } = useParams();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Taxa Details
      </Typography>
      <Typography>
        Taxa ID: {taxaId}
      </Typography>
      <Typography>
        Detailed taxa information will be displayed here.
      </Typography>
    </Box>
  );
};

export default TaxaDetail; 