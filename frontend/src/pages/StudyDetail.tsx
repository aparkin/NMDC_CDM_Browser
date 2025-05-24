import { useParams } from 'react-router-dom';
import { Typography, Box } from '@mui/material';

const StudyDetail = () => {
  const { studyId } = useParams();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Study Details
      </Typography>
      <Typography>
        Study ID: {studyId}
      </Typography>
      <Typography>
        Detailed study information will be displayed here.
      </Typography>
    </Box>
  );
};

export default StudyDetail; 