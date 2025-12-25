import React from 'react';
import { Container, Typography, Button, Box, Grid, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
          background: 'linear-gradient(135deg, #4a7c59, #6b9e78)',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            AyurVeda Wellness Center
          </Typography>
          <Typography variant="h6" sx={{ mb: 5, opacity: 0.9 }}>
            Traditional Ayurvedic Treatments • Holistic Healing • Personalized Care
          </Typography>
          <Button
            variant="contained"
            size="large"
            sx={{ mr: 3, bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: '#f0f0f0' } }}
            onClick={() => navigate('/login')}
          >
            Login
          </Button>
          <Button
            variant="outlined"
            size="large"
            sx={{ borderColor: 'white', color: 'white' }}
            onClick={() => navigate('/signup')}
          >
            Sign Up as Patient
          </Button>
        </Container>
      </Box>

      <Container sx={{ py: 8 }}>
        <Typography variant="h4" align="center" gutterBottom color="primary">
          Why Choose AyurVeda?
        </Typography>
        <Grid container spacing={4} sx={{ mt: 3 }}>
          {['Expert Doctors & Therapists', 'Easy Online Booking', 'Personalized Treatment Plans'].map((title, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Card elevation={4} sx={{ height: '100%', textAlign: 'center' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {i === 0 && 'Certified practitioners with deep knowledge in Panchakarma and herbal medicine.'}
                    {i === 1 && 'Book appointments and therapy sessions anytime from your phone or computer.'}
                    {i === 2 && 'View your medical history, reports, and track progress securely.'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 4, textAlign: 'center' }}>
        <Typography>© 2025 AyurVeda Wellness Center. All rights reserved.</Typography>
      </Box>
    </Box>
  );
};

export default Home;