import React, { useContext } from 'react';
import { Typography } from '@mui/material';  // ← Added import
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

const TherapistDashboard = () => {
  const { currentUser } = useContext(AuthContext);

  return (
    <DashboardLayout title="Therapist Dashboard">
      <Typography variant="h6" gutterBottom>
        Welcome, {currentUser?.email.split('@')[0] || 'Therapist'}!
      </Typography>
      <Typography variant="body1">
        View your assigned therapy sessions, update status, and add session notes.
      </Typography>
    </DashboardLayout>
  );
};

export default TherapistDashboard;