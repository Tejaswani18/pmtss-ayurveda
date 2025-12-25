import React, { useContext } from 'react';
import { Typography } from '@mui/material';  // ← Added import
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

const DoctorDashboard = () => {
  const { currentUser } = useContext(AuthContext);

  return (
    <DashboardLayout title="Doctor Dashboard">
      <Typography variant="h6" gutterBottom>
        Hello, Dr. {currentUser?.email.split('@')[0] || 'Doctor'}!
      </Typography>
      <Typography variant="body1">
        Here you can view patient histories, add diagnoses, prescribe therapies, and monitor progress.
      </Typography>
    </DashboardLayout>
  );
};

export default DoctorDashboard;