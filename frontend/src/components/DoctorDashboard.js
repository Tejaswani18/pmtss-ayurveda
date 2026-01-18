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
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSnackbar } from 'notistack';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

const DoctorDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const [prescription, setPrescription] = useState('');
  const [therapies, setTherapies] = useState([]);
  const [newTherapy, setNewTherapy] = useState({
    type: '',
    duration: '',
    therapistId: '',
    numSessions: 1,  // New field: Number of sessions
  });

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch appointments
        const apptQuery = query(
          collection(db, 'appointments'),
          where('doctorId', '==', currentUser.uid),
          orderBy('date', 'asc'),
          orderBy('time', 'asc')
        );
        const apptSnap = await getDocs(apptQuery);
        setAppointments(apptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Fetch therapists
        const therapistQuery = query(collection(db, 'users'), where('role', '==', 'therapist'));
        const therapistSnap = await getDocs(therapistQuery);
        setTherapists(therapistSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        enqueueSnackbar('Failed to load data', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, enqueueSnackbar]);

  const handleViewAppointment = (appt) => {
    setSelectedAppt(appt);
    setPrescription(appt.prescription || '');
    setTherapies(appt.therapies || []);
  };

  const handleClose = () => {
    setSelectedAppt(null);
    setPrescription('');
    setTherapies([]);
    setNewTherapy({ type: '', duration: '', therapistId: '', numSessions: 1 });
  };

  const handleAddTherapy = () => {
    if (!newTherapy.type || !newTherapy.duration || !newTherapy.therapistId || newTherapy.numSessions < 1) {
      enqueueSnackbar('Please fill all therapy fields', { variant: 'warning' });
      return;
    }

    const therapist = therapists.find((t) => t.id === newTherapy.therapistId);

    setTherapies([
      ...therapies,
      {
        type: newTherapy.type,
        duration: newTherapy.duration,
        therapistId: newTherapy.therapistId,
        therapistName: therapist?.name || 'Unknown',
        numSessions: newTherapy.numSessions,
      },
    ]);

    setNewTherapy({ type: '', duration: '', therapistId: '', numSessions: 1 });
  };

  const handleRemoveTherapy = (index) => {
    setTherapies(therapies.filter((_, i) => i !== index));
  };

  const handleSavePrescription = async () => {
    if (!selectedAppt) return;

    try {
      // Update appointment
      await updateDoc(doc(db, 'appointments', selectedAppt.id), {
        prescription,
        therapies,
      });

      // Create multiple therapy sessions for each prescribed therapy
      for (const therapy of therapies) {
        for (let sessionNum = 1; sessionNum <= therapy.numSessions; sessionNum++) {
          // Calculate sequential date for each session (e.g., daily)
          const sessionDate = new Date(selectedAppt.date);
          sessionDate.setDate(sessionDate.getDate() + sessionNum - 1);  // Session 1: same day, Session 2: next day, etc.

          await addDoc(collection(db, 'therapySessions'), {
            patientId: selectedAppt.patientId,
            patientName: selectedAppt.patientName,
            therapyType: therapy.type,
            duration: parseInt(therapy.duration),
            therapistId: therapy.therapistId,
            therapistName: therapy.therapistName,
            status: 'scheduled',
            sessionNumber: sessionNum,
            totalSessions: therapy.numSessions,
            prescribedBy: currentUser.uid,
            appointmentId: selectedAppt.id,
            dateTime: Timestamp.fromDate(
              new Date(`${sessionDate.toISOString().split('T')[0]}T${selectedAppt.time}`)
            ),
            createdAt: new Date(),
          });
        }
      }

      enqueueSnackbar('Prescription and therapy sessions saved!', { variant: 'success' });

      // Refresh appointments
      const apptQuery = query(
        collection(db, 'appointments'),
        where('doctorId', '==', currentUser.uid),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
      );
      const apptSnap = await getDocs(apptQuery);
      setAppointments(apptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      handleClose();
    } catch (err) {
      enqueueSnackbar('Failed to save prescription', { variant: 'error' });
      console.error(err);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedAppt) return;

    try {
      await updateDoc(doc(db, 'appointments', selectedAppt.id), {
        status: 'completed',
      });

      enqueueSnackbar('Appointment marked as completed', { variant: 'success' });

      // Refresh appointments
      const apptQuery = query(
        collection(db, 'appointments'),
        where('doctorId', '==', currentUser.uid),
        orderBy('date', 'asc'),
        orderBy('time', 'asc')
      );
      const apptSnap = await getDocs(apptQuery);
      setAppointments(apptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      handleClose();
    } catch (err) {
      enqueueSnackbar('Failed to update status', { variant: 'error' });
    }
  };

  const getStatusChip = (status) => {
    const colors = {
      confirmed: 'primary',
      completed: 'success',
      cancelled: 'error',
    };
    return <Chip label={status?.toUpperCase()} color={colors[status] || 'default'} size="small" />;
  };

  if (loading) {
    return (
      <DashboardLayout title="Doctor Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Doctor Dashboard">
      <Typography variant="h5" gutterBottom>
        Welcome, Dr. {currentUser?.email.split('@')[0] || 'Doctor'}!
      </Typography>

      <Typography variant="h6" gutterBottom>
        Today's & Upcoming Appointments ({appointments.length})
      </Typography>

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Time</strong></TableCell>
              <TableCell><strong>Patient</strong></TableCell>
              <TableCell><strong>Reason</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No appointments scheduled
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appt) => (
                <TableRow key={appt.id} hover>
                  <TableCell>{new Date(appt.date).toLocaleDateString()}</TableCell>
                  <TableCell>{appt.time}</TableCell>
                  <TableCell>{appt.patientName}</TableCell>
                  <TableCell>{appt.reason}</TableCell>
                  <TableCell>{getStatusChip(appt.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleViewAppointment(appt)}
                      disabled={appt.status === 'completed'}
                    >
                      {appt.status === 'completed' ? 'Completed' : 'Prescribe'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Prescription Modal */}
      <Dialog open={!!selectedAppt} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Prescribe for {selectedAppt?.patientName} ({new Date(selectedAppt?.date).toLocaleDateString()} at {selectedAppt?.time})
        </DialogTitle>
        <DialogContent dividers>
          {selectedAppt && (
            <>
              <Typography><strong>Reason:</strong> {selectedAppt.reason}</Typography>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>Prescription</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  placeholder="Diagnosis, medicines, advice..."
                />
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>Prescribe Therapies</Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Therapy Type"
                      value={newTherapy.type}
                      onChange={(e) => setNewTherapy({ ...newTherapy, type: e.target.value })}
                      placeholder="e.g., Abhyanga"
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="Duration (mins)"
                      type="number"
                      value={newTherapy.duration}
                      onChange={(e) => setNewTherapy({ ...newTherapy, duration: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <FormControl fullWidth>
                      <InputLabel>Assign Therapist</InputLabel>
                      <Select
                        value={newTherapy.therapistId}
                        onChange={(e) => setNewTherapy({ ...newTherapy, therapistId: e.target.value })}
                        label="Assign Therapist"
                      >
                        {therapists.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name} ({t.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      fullWidth
                      label="No. of Sessions"
                      type="number"
                      value={newTherapy.numSessions}
                      onChange={(e) => setNewTherapy({ ...newTherapy, numSessions: parseInt(e.target.value) })}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton color="primary" onClick={handleAddTherapy}>
                      <AddIcon />
                    </IconButton>
                  </Grid>
                </Grid>

                {therapies.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2">Prescribed Therapies:</Typography>
                    {therapies.map((t, i) => (
                      <Chip
                        key={i}
                        label={`${t.type} (${t.duration} mins, ${t.numSessions} sessions) - ${t.therapistName}`}
                        onDelete={() => handleRemoveTherapy(i)}
                        deleteIcon={<DeleteIcon />}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePrescription}>
            Save Prescription
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleMarkComplete}
            disabled={selectedAppt?.status === 'completed'}
          >
            Mark Completed
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default DoctorDashboard;