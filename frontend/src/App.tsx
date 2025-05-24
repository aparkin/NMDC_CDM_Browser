import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import StudyList from './components/StudyList';
import Layout from './components/Layout';
import StudySetSummary from './pages/StudySetSummary';
import StudyDashboard from './pages/StudyDashboard';

// Create a theme instance
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<StudyList />} />
            <Route path="/studies/:studyId" element={<StudyDashboard />} />
            <Route path="/set" element={<StudySetSummary />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
