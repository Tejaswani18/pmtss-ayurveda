import React, { useState, useEffect } from 'react';
import {
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
} from '@mui/material';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [feedbackData, setFeedbackData] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'doctor',
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const userList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(userList);
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to load users.' });
        console.error(err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch feedback for sentiment analysis
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const feedbackSnap = await getDocs(collection(db, 'feedback'));
        const data = {};

        feedbackSnap.forEach((doc) => {
          const fb = doc.data();
          if (!fb.doctorId) return;

          if (!data[fb.doctorId]) {
            data[fb.doctorId] = { positive: 0, negative: 0, neutral: 0 };
          }
          data[fb.doctorId][fb.sentiment]++;
        });

        setFeedbackData(data);
      } catch (err) {
        console.error('Error fetching feedback:', err);
      } finally {
        setLoadingFeedback(false);
      }
    };
    fetchFeedback();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);

    const { name, email, phone, password, role } = formData;

    if (!name || !email || !phone || !password) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      setSubmitting(false);
      return;
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Add to users collection
      await addDoc(collection(db, 'users'), {
        uid: user.uid,
        name,
        email,
        phone,
        role,
        createdAt: serverTimestamp(),
      });

      // Optional: Create empty profile
      if (role === 'doctor') {
        await addDoc(collection(db, 'doctors'), { uid: user.uid, specialization: '' });
      } else if (role === 'therapist') {
        await addDoc(collection(db, 'therapists'), { uid: user.uid, skills: [] });
      }

      setMessage({
        type: 'success',
        text: `${role.charAt(0).toUpperCase() + role.slice(1)} added successfully!`,
      });
      setFormData({ name: '', email: '', phone: '', password: '', role: 'doctor' });

      // Refresh users list
      const querySnapshot = await getDocs(collection(db, 'users'));
      setUsers(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      let msg = 'Failed to add user.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      else if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      else if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
      setMessage({ type: 'error', text: msg });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <Box>
      {/* Add New Doctor/Therapist Form */}
      <Paper sx={{ p: 4, mb: 6, bgcolor: '#f9f9f9', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          Add New Doctor or Therapist
        </Typography>

        {message.text && (
          <Alert
            severity={message.type}
            sx={{ mb: 3 }}
            onClose={() => setMessage({ type: '', text: '' })}
          >
            {message.text}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
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
                  value={formData.role}
                  onChange={handleChange}
                  label="Role"
                >
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
                disabled={submitting}
                sx={{ py: 1.5 }}
              >
                {submitting ? <CircularProgress size={28} /> : 'Add User'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* All Users Table */}
      <Typography variant="h6" gutterBottom>
        All Registered Users ({users.length})
      </Typography>
      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <strong>{user.role?.toUpperCase()}</strong>
                    </TableCell>
                    <TableCell>
                      {user.createdAt?.toDate?.().toLocaleDateString() || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Feedback Sentiment Analysis Section */}
      <Typography variant="h6" gutterBottom sx={{ mt: 8, mb: 3 }}>
        Patient Feedback Sentiment Analysis by Doctor
      </Typography>
      {loadingFeedback ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : Object.keys(feedbackData).length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No patient feedback has been submitted yet.
        </Alert>
      ) : (
        <Grid container spacing={4}>
          {Object.entries(feedbackData).map(([doctorId, sentiments]) => {
            const doctor = users.find((u) => u.id === doctorId && u.role === 'doctor');
            if (!doctor) return null;

            const total = sentiments.positive + sentiments.negative + sentiments.neutral;

            const chartData = {
              labels: ['Positive', 'Negative', 'Neutral'],
              datasets: [
                {
                  data: [sentiments.positive, sentiments.negative, sentiments.neutral],
                  backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
                  borderColor: ['#388e3c', '#d32f2f', '#f57c00'],
                  borderWidth: 2,
                },
              ],
            };

            return (
              <Grid item xs={12} md={6} lg={4} key={doctorId}>
                <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {doctor.name || 'Dr. Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {doctor.email}
                  </Typography>
                  <Typography variant="h6" gutterBottom>
                    Total Feedback: {total}
                  </Typography>
                  <Box sx={{ height: 260, mt: 2 }}>
                    <Pie data={chartData} options={chartOptions} />
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default UserManagement;