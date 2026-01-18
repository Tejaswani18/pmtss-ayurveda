import React, { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Tab,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import DashboardLayout from './DashboardLayout';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminDashboard = () => {
  const [tabValue, setTabValue] = useState(0);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [therapySessions, setTherapySessions] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  // New User Creation State
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'patient',
  });
  const [createMessage, setCreateMessage] = useState({ type: '', text: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setPatients(allUsers.filter((u) => u.role === 'patient'));
        setDoctors(allUsers.filter((u) => u.role === 'doctor'));
        setTherapists(allUsers.filter((u) => u.role === 'therapist'));

        const apptSnap = await getDocs(collection(db, 'appointments'));
        setAppointments(apptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const therapySnap = await getDocs(collection(db, 'therapySessions'));
        setTherapySessions(therapySnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const feedbackSnap = await getDocs(collection(db, 'feedback'));
        setFeedbacks(feedbackSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTabChange = (_, newValue) => setTabValue(newValue);

  // Handle new user form
  const handleNewUserChange = (e) => {
    setNewUserForm({ ...newUserForm, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateMessage({ type: '', text: '' });
    setCreating(true);

    const { name, email, phone, password, role } = newUserForm;

    if (!name || !email || !phone || !password) {
      setCreateMessage({ type: 'error', text: 'All fields are required.' });
      setCreating(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await addDoc(collection(db, 'users'), {
        uid: user.uid,
        name,
        email,
        phone,
        role,
        createdAt: serverTimestamp(),
      });

      setCreateMessage({
        type: 'success',
        text: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully!`,
      });
      setNewUserForm({ name: '', email: '', phone: '', password: '', role: 'patient' });

      // Refresh users
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPatients(allUsers.filter((u) => u.role === 'patient'));
      setDoctors(allUsers.filter((u) => u.role === 'doctor'));
      setTherapists(allUsers.filter((u) => u.role === 'therapist'));
    } catch (err) {
      let msg = 'Failed to create user.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email already exists.';
      else if (err.code === 'auth/weak-password') msg = 'Password too weak.';
      setCreateMessage({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  // Chart data functions (unchanged)
  const getPatientGrowth = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const growth = new Array(12).fill(0);
    patients.forEach((p) => {
      if (p.createdAt) {
        const month = p.createdAt.toDate().getMonth();
        growth[month]++;
      }
    });
    return {
      labels: months,
      datasets: [{
        label: 'New Patients',
        data: growth,
        borderColor: '#4a7c59',
        backgroundColor: 'rgba(74, 124, 89, 0.2)',
        tension: 0.3,
        fill: true,
      }],
    };
  };

  const getTherapyUtilization = () => {
    const types = {};
    therapySessions.forEach((s) => {
      const type = s.therapyType || 'Unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return {
      labels: Object.keys(types),
      datasets: [{
        label: 'Number of Sessions',
        data: Object.values(types),
        backgroundColor: 'rgba(139, 168, 136, 0.8)',
      }],
    };
  };

  const getPatientDistribution = () => {
    const depts = {};
    therapySessions.forEach((s) => {
      const dept = s.therapyType || 'General';
      depts[dept] = (depts[dept] || new Set()).add(s.patientId);
    });
    return {
      labels: Object.keys(depts),
      datasets: [{
        data: Object.values(depts).map(set => set.size),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
      }],
    };
  };

  const getAppointmentsPerDoctor = () => {
    const counts = {};
    doctors.forEach((d) => (counts[d.id] = 0));
    appointments.forEach((a) => {
      if (counts[a.doctorId] !== undefined) counts[a.doctorId]++;
    });
    return {
      labels: doctors.map((d) => d.name || d.email.split('@')[0]),
      datasets: [{
        label: 'Appointments',
        data: doctors.map((d) => counts[d.id]),
        backgroundColor: 'rgba(74, 124, 89, 0.7)',
      }],
    };
  };

  const getFeedbackAnalysis = (role) => {
    const people = role === 'doctor' ? doctors : therapists;
    const analysis = {};
    people.forEach((p) => (analysis[p.id] = { positive: 0, negative: 0, neutral: 0 }));
    feedbacks.forEach((f) => {
      const id = role === 'doctor' ? f.doctorId : f.therapistId;
      if (id && analysis[id]) analysis[id][f.sentiment]++;
    });
    return analysis;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { font: { size: 14 } } },
      tooltip: { bodyFont: { size: 14 }, titleFont: { size: 16 } },
    },
    scales: {
      x: { ticks: { font: { size: 12 } } },
      y: { ticks: { font: { size: 12 } }, beginAtZero: true },
    },
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress size={60} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      <Typography variant="h4" gutterBottom align="center" color="primary" sx={{ mb: 4 }}>
        AyurVeda Clinic - Admin Analytics
      </Typography>

      {/* New User Creation Section */}
      <Paper sx={{ p: 4, mb: 6, bgcolor: '#f0f8f0', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          Create New User
        </Typography>

        {createMessage.text && (
          <Alert
            severity={createMessage.type}
            sx={{ mb: 3 }}
            onClose={() => setCreateMessage({ type: '', text: '' })}
          >
            {createMessage.text}
          </Alert>
        )}

        <Box component="form" onSubmit={handleCreateUser}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full Name"
                name="name"
                value={newUserForm.name}
                onChange={handleNewUserChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                name="email"
                type="email"
                value={newUserForm.email}
                onChange={handleNewUserChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                name="phone"
                value={newUserForm.phone}
                onChange={handleNewUserChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Password"
                name="password"
                type="password"
                value={newUserForm.password}
                onChange={handleNewUserChange}
                fullWidth
                required
                helperText="Minimum 6 characters"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  value={newUserForm.role}
                  onChange={handleNewUserChange}
                  label="Role"
                >
                  <MenuItem value="patient">Patient</MenuItem>
                  <MenuItem value="doctor">Doctor</MenuItem>
                  <MenuItem value="therapist">Therapist</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={creating}
                sx={{ py: 1.5 }}
              >
                {creating ? <CircularProgress size={28} /> : 'Create User'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Tabs value={tabValue} onChange={handleTabChange} centered sx={{ mb: 5 }}>
        <Tab label="Patients" />
        <Tab label="Doctors" />
        <Tab label="Therapists" />
        <Tab label="Analytics & Graphs" />
      </Tabs>

      {/* Patients Tab */}
      <TabPanel value={tabValue} index={0}>
        <Typography variant="h5" gutterBottom>
          Patients ({patients.length})
        </Typography>
        <TableContainer component={Paper} elevation={4}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Joined</strong></TableCell>
                <TableCell><strong>Total Appointments</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((p) => {
                const appts = appointments.filter((a) => a.patientId === p.id).length;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.name || 'N/A'}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{p.phone || 'N/A'}</TableCell>
                    <TableCell>{p.createdAt?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
                    <TableCell>{appts}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Doctors Tab */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h5" gutterBottom>
          Doctors ({doctors.length})
        </Typography>
        <TableContainer component={Paper} elevation={4}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Joined</strong></TableCell>
                <TableCell><strong>Appointments Booked</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {doctors.map((d) => {
                const booked = appointments.filter((a) => a.doctorId === d.id).length;
                return (
                  <TableRow key={d.id}>
                    <TableCell>{d.name || 'Dr. Unknown'}</TableCell>
                    <TableCell>{d.email}</TableCell>
                    <TableCell>{d.phone || 'N/A'}</TableCell>
                    <TableCell>{d.createdAt?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
                    <TableCell>{booked}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Therapists Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h5" gutterBottom>
          Therapists ({therapists.length})
        </Typography>
        <TableContainer component={Paper} elevation={4}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Joined</strong></TableCell>
                <TableCell><strong>Assigned Sessions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {therapists.map((t) => {
                const sessions = therapySessions.filter((s) => s.therapistId === t.id).length;
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.name || 'Unknown'}</TableCell>
                    <TableCell>{t.email}</TableCell>
                    <TableCell>{t.phone || 'N/A'}</TableCell>
                    <TableCell>{t.createdAt?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
                    <TableCell>{sessions}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Analytics & Graphs Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={5}>
          {/* Patient Growth */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 4, height: 520 }}>
              <Typography variant="h6" gutterBottom align="center">
                Patient Growth Per Month
              </Typography>
              <Box sx={{ height: 440 }}>
                <Line data={getPatientGrowth()} options={chartOptions} />
              </Box>
            </Paper>
          </Grid>

          {/* Therapy Utilization */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 4, height: 520 }}>
              <Typography variant="h6" gutterBottom align="center">
                Therapy Utilization
              </Typography>
              <Box sx={{ height: 440 }}>
                <Bar data={getTherapyUtilization()} options={chartOptions} />
              </Box>
            </Paper>
          </Grid>

          {/* Patient Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, height: 520 }}>
              <Typography variant="h6" gutterBottom align="center">
                Patient Distribution by Therapy Type
              </Typography>
              <Box sx={{ height: 440, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ width: 400, height: 400 }}>
                  <Pie data={getPatientDistribution()} options={{ ...chartOptions, maintainAspectRatio: true }} />
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Appointments per Doctor */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, height: 520 }}>
              <Typography variant="h6" gutterBottom align="center">
                Appointments Booked per Doctor
              </Typography>
              <Box sx={{ height: 440 }}>
                <Bar data={getAppointmentsPerDoctor()} options={chartOptions} />
              </Box>
            </Paper>
          </Grid>

          {/* Feedback Analysis */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom align="center" sx={{ mt: 4 }}>
              Patient Feedback Sentiment Analysis
            </Typography>

            <Typography variant="h6" gutterBottom>Doctors</Typography>
            <Grid container spacing={4}>
              {Object.entries(getFeedbackAnalysis('doctor')).map(([id, data]) => {
                const doctor = doctors.find((d) => d.id === id);
                if (!doctor) return null;
                const total = data.positive + data.negative + data.neutral;

                return (
                  <Grid item xs={12} sm={6} md={4} key={id}>
                    <Paper sx={{ p: 3, height: 420, textAlign: 'center' }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {doctor.name || doctor.email}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Feedback: {total}
                      </Typography>
                      <Box sx={{ height: 320, mt: 2 }}>
                        <Pie
                          data={{
                            labels: ['Positive', 'Negative', 'Neutral'],
                            datasets: [{
                              data: [data.positive, data.negative, data.neutral],
                              backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { font: { size: 14 } } } },
                          }}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ mt: 6 }}>Therapists</Typography>
            <Grid container spacing={4}>
              {Object.entries(getFeedbackAnalysis('therapist')).map(([id, data]) => {
                const therapist = therapists.find((t) => t.id === id);
                if (!therapist) return null;
                const total = data.positive + data.negative + data.neutral;

                return (
                  <Grid item xs={12} sm={6} md={4} key={id}>
                    <Paper sx={{ p: 3, height: 420, textAlign: 'center' }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {therapist.name || therapist.email}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Feedback: {total}
                      </Typography>
                      <Box sx={{ height: 320, mt: 2 }}>
                        <Pie
                          data={{
                            labels: ['Positive', 'Negative', 'Neutral'],
                            datasets: [{
                              data: [data.positive, data.negative, data.neutral],
                              backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { font: { size: 14 } } } },
                          }}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Grid>
        </Grid>
      </TabPanel>
    </DashboardLayout>
  );
};

export default AdminDashboard;