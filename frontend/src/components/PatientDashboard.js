import React, { useContext } from 'react';
import { Typography, Button } from '@mui/material';  // ← Added import
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

const PatientDashboard = () => {
  const { currentUser } = useContext(AuthContext);

  return (
    <DashboardLayout title="Patient Dashboard">
      <Typography variant="h6" gutterBottom>
        Welcome back, {currentUser?.email.split('@')[0] || 'Patient'}!
      </Typography>
      <Typography variant="body1">
        Book appointments, view your therapy schedule, medical reports, and provide feedback.
      </Typography>
      {/* Future features here */}
    </DashboardLayout>
  );
};

export default PatientDashboard;