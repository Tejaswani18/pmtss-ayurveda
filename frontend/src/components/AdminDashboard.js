import React from 'react';
import { Typography } from '@mui/material';  // ← Make sure this is here
import DashboardLayout from './DashboardLayout';
import UserManagement from './UserManagement';

const AdminDashboard = () => {
  return (
    <DashboardLayout title="Admin Dashboard">
      <Typography variant="h5" gutterBottom>
        Welcome, Administrator!
      </Typography>
      <UserManagement />
    </DashboardLayout>
  );
};

export default AdminDashboard;