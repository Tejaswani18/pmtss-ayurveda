import React, { useState, useContext } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Link,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'therapist', label: 'Therapist' },
    { value: 'patient', label: 'Patient' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRole) {
      setError('Please select your role');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Firebase Auth login
      const userCredential = await login(email, password);
      const user = userCredential.user;

      // Fetch actual role from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setError('User profile not found. Contact admin.');
        setLoading(false);
        return;
      }

      const actualRole = userDoc.data().role;

      // Security: Compare selected role with actual role
      if (actualRole !== selectedRole) {
        setError(`This account is registered as ${actualRole}. Please select the correct role.`);
        setLoading(false);
        return;
      }

      // Redirect to role-specific dashboard
      navigate(`/${actualRole}`);
    } catch (err) {
      let message = 'Failed to log in. Please check your email and password.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Try again later.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          mt: { xs: 4, md: 8 },
          mb: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={8} sx={{ p: { xs: 3, sm: 5 }, width: '100%', borderRadius: 3 }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom fontWeight="bold" color="primary">
            Welcome Back
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
            Sign in to AyurVeda Wellness Center
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="role-select-label">Login As</InputLabel>
              <Select
                labelId="role-select-label"
                value={selectedRole}
                label="Login As"
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={loading}
              >
                {roles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 4, mb: 3, py: 1.6, borderRadius: 2 }}
              disabled={loading || !selectedRole}
            >
              {loading ? <CircularProgress size={28} color="inherit" /> : 'Sign In'}
            </Button>

            <Box textAlign="center">
              <Link component={RouterLink} to="/signup" variant="body2">
                New patient? Sign up here
              </Link>
            </Box>

            <Typography variant="caption" display="block" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
              Note: Admin, Doctor, and Therapist accounts are created by the clinic administrator.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;