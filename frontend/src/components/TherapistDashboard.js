import React, { useContext, useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

const TherapistDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    const fetchSessions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'therapySessions'),
          where('therapistId', '==', currentUser.uid),
          orderBy('dateTime', 'asc')
        );
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        enqueueSnackbar('Failed to load sessions', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [currentUser, enqueueSnackbar]);

  const handleViewSession = (session) => {
    setSelectedSession(session);
    setStatus(session.status || 'scheduled');
    setNotes(session.notes || '');
  };

  const handleClose = () => {
    setSelectedSession(null);
    setStatus('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!selectedSession) return;

    try {
      await updateDoc(doc(db, 'therapySessions', selectedSession.id), {
        status,
        notes,
        updatedAt: new Date(),
      });

      enqueueSnackbar('Session updated!', { variant: 'success' });

      const q = query(
        collection(db, 'therapySessions'),
        where('therapistId', '==', currentUser.uid),
        orderBy('dateTime', 'asc')
      );
      const snap = await getDocs(q);
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      handleClose();
    } catch (err) {
      enqueueSnackbar('Failed to update', { variant: 'error' });
    }
  };

  const getStatusChip = (status) => {
    const colors = {
      scheduled: 'default',
      'in-progress': 'primary',
      completed: 'success',
      cancelled: 'error',
    };
    return <Chip label={(status || 'scheduled').toUpperCase()} color={colors[status] || 'default'} size="small" />;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Not set';
    try {
      return timestamp.toDate().toLocaleString();
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Therapist Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Therapist Dashboard">
      <Typography variant="h5" gutterBottom>
        Welcome, {currentUser?.email.split('@')[0] || 'Therapist'}!
      </Typography>

      <Typography variant="h6" gutterBottom>
        Your Therapy Sessions ({sessions.length})
      </Typography>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Therapy</strong></TableCell>
              <TableCell><strong>Patient</strong></TableCell>
              <TableCell><strong>Progress</strong></TableCell>
              <TableCell><strong>Date & Time</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No sessions assigned</TableCell></TableRow>
            ) : (
              Object.entries(
                sessions.reduce((groups, session) => {
                  const key = `${session.therapyType}_${session.patientId}`;
                  if (!groups[key]) {
                    groups[key] = {
                      sessions: [],
                      total: session.totalSessions || sessions.filter(s => s.therapyType === session.therapyType && s.patientId === session.patientId).length,
                    };
                  }
                  groups[key].sessions.push(session);
                  return groups;
                }, {})
              ).map(([key, { sessions, total }]) => {
                const completed = sessions.filter(s => s.status === 'completed').length;
                const percentage = total > 0 ? (completed / total) * 100 : 0;
                const therapyType = sessions[0].therapyType;
                const patientName = sessions[0].patientName;

                return (
                  <React.Fragment key={key}>
                    <TableRow>
                      <TableCell rowSpan={sessions.length + 1}>
                        <Typography variant="subtitle1">{therapyType}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          for {patientName}
                        </Typography>
                      </TableCell>
                      <TableCell rowSpan={sessions.length + 1}>
                        <LinearProgress variant="determinate" value={percentage} sx={{ height: 10, borderRadius: 5 }} />
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {completed}/{total} completed ({percentage.toFixed(1)}%)
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{formatDateTime(session.dateTime)}</TableCell>
                        <TableCell>{getStatusChip(session.status)}</TableCell>
                        <TableCell>
                          <Button variant="outlined" size="small" onClick={() => handleViewSession(session)}>
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Update Modal */}
      <Dialog open={!!selectedSession} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Update Session: {selectedSession?.therapyType}</DialogTitle>
        <DialogContent dividers>
          {selectedSession && (
            <>
              <Typography><strong>Patient:</strong> {selectedSession.patientName}</Typography>
              <Typography><strong>Date & Time:</strong> {formatDateTime(selectedSession.dateTime)}</Typography>
              <Typography><strong>Session:</strong> {selectedSession.sessionNumber} of {selectedSession.totalSessions}</Typography>

              <Box sx={{ mt: 4 }}>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="in-progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Session Notes"
                  multiline
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Patient response, observations..."
                />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default TherapistDashboard;