import React, { useContext, useState, useEffect } from 'react';
import {
  Typography,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Grid,
  Tabs,
  Tab,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Avatar,
  Alert,
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
  addDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import DashboardLayout from './DashboardLayout';
import { AuthContext } from '../contexts/AuthContext';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 4 }}>{children}</Box>}
    </div>
  );
}

// ────────────────────────────────────────────────
// Hugging Face Sentiment Analysis (unchanged)
// ────────────────────────────────────────────────
const analyzeSentiment = async (text) => {
  if (!text || text.trim() === '') return 'neutral';

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest",
      {
        headers: {
          Authorization: `Bearer ${process.env.REACT_APP_HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) throw new Error(`HF API error: ${response.status}`);

    const result = await response.json();
    const topLabel = result[0][0]?.label?.toLowerCase() || '';

    if (topLabel.includes('positive') || topLabel === 'label_2') return 'positive';
    if (topLabel.includes('negative') || topLabel === 'label_0') return 'negative';
    return 'neutral';
  } catch (err) {
    console.error("Hugging Face API failed:", err);
    return fallbackRuleBasedSentiment(text);
  }
};

const fallbackRuleBasedSentiment = (text) => {
  text = text.toLowerCase();
  const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'helpful', 'best', 'love', 'awesome', 'relaxing', 'fantastic'];
  const negative = ['bad', 'worst', 'terrible', 'pain', 'hurt', 'poor', 'disappointing', 'waste', 'not good'];

  let score = 0;
  positive.forEach((w) => text.includes(w) && score++);
  negative.forEach((w) => text.includes(w) && score--);

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
};

// Reminder checker (unchanged)
const checkReminders = (appointments, therapySessions, enqueueSnackbar) => {
  const now = new Date();
  const tenHours = 10 * 60 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const tolerance = 10 * 60 * 1000;

  appointments.forEach((appt) => {
    if (appt.status !== 'confirmed') return;
    const apptTime = new Date(`${appt.date}T${appt.time}:00`);
    const diff = apptTime - now;

    if (Math.abs(diff - tenHours) < tolerance) {
      enqueueSnackbar(`Reminder: Doctor appointment in 10 hours (${appt.date} at ${appt.time})`, { variant: 'info', autoHideDuration: 8000 });
    } else if (Math.abs(diff - oneHour) < tolerance) {
      enqueueSnackbar(`URGENT: Doctor appointment in 1 hour!`, { variant: 'warning', autoHideDuration: 10000 });
    }
  });

  therapySessions.forEach((session) => {
    if (session.status !== 'scheduled') return;
    if (!session.dateTime) return;
    const sessionTime = session.dateTime.toDate();
    const diff = sessionTime - now;

    if (Math.abs(diff - tenHours) < tolerance) {
      enqueueSnackbar(`Reminder: ${session.therapyType} session in 10 hours`, { variant: 'info', autoHideDuration: 8000 });
    } else if (Math.abs(diff - oneHour) < tolerance) {
      enqueueSnackbar(`URGENT: ${session.therapyType} session in 1 hour!`, { variant: 'warning', autoHideDuration: 10000 });
    }
  });
};

const PatientDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  const [tabValue, setTabValue] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [therapySessions, setTherapySessions] = useState([]);
  const [patientInfo, setPatientInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const [selectedAppt, setSelectedAppt] = useState(null);
  const [feedback, setFeedback] = useState({ rating: 0, comments: '' });

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

  const [bookingForm, setBookingForm] = useState({
    doctorId: '',
    date: '',
    time: '',
    reason: '',
  });

  // ────────────────────────────────────────────────
  // Chatbot States
  // ────────────────────────────────────────────────
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // ────────────────────────────────────────────────
  // TEMPORARY DEBUG: Check if Hugging Face API key is loaded
  // ────────────────────────────────────────────────
  useEffect(() => {
    console.log("HF API Key loaded?", !!process.env.REACT_APP_HF_API_KEY);
    console.log(
      "API Key value (first 5 chars only):",
      process.env.REACT_APP_HF_API_KEY?.substring(0, 5) || "NOT_FOUND"
    );
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const doctorSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'doctor')));
        setDoctors(doctorSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const apptSnap = await getDocs(
          query(
            collection(db, 'appointments'),
            where('patientId', '==', currentUser.uid),
            orderBy('date', 'desc')
          )
        );
        setAppointments(apptSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const therapySnap = await getDocs(
          query(
            collection(db, 'therapySessions'),
            where('patientId', '==', currentUser.uid),
            orderBy('dateTime', 'asc')
          )
        );
        setTherapySessions(therapySnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const patientSnap = await getDocs(
          query(collection(db, 'patients'), where('patientId', '==', currentUser.uid))
        );
        if (!patientSnap.empty) {
          setPatientInfo(patientSnap.docs[0].data());
        }
      } catch (err) {
        enqueueSnackbar('Failed to load data', { variant: 'error' });
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, enqueueSnackbar]);

  // Check reminders after data loaded
  useEffect(() => {
    if (!loading) {
      checkReminders(appointments, therapySessions, enqueueSnackbar);
    }
  }, [loading, appointments, therapySessions, enqueueSnackbar]);

  const handleTabChange = (_, newValue) => setTabValue(newValue);

  const handleBookingChange = (e) => {
    setBookingForm({ ...bookingForm, [e.target.name]: e.target.value });
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingForm.doctorId || !bookingForm.date || !bookingForm.time || !bookingForm.reason) {
      enqueueSnackbar('All fields are required', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const doctor = doctors.find((d) => d.id === bookingForm.doctorId);

      await addDoc(collection(db, 'appointments'), {
        patientId: currentUser.uid,
        patientName: currentUser.email.split('@')[0],
        doctorId: bookingForm.doctorId,
        doctorName: doctor?.name || 'Dr.',
        date: bookingForm.date,
        time: bookingForm.time,
        reason: bookingForm.reason,
        status: 'confirmed',
        prescription: '',
        therapies: [],
        feedbackGiven: false,
        createdAt: new Date(),
      });

      enqueueSnackbar('Appointment booked successfully!', { variant: 'success' });
      setBookingForm({ doctorId: '', date: '', time: '', reason: '' });

      const snap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('patientId', '==', currentUser.uid),
          orderBy('date', 'desc')
        )
      );
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      enqueueSnackbar('Failed to book appointment', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (appt) => setSelectedAppt(appt);
  const handleCloseDetails = () => {
    setSelectedAppt(null);
    setFeedback({ rating: 0, comments: '' });
  };

  const handleSubmitFeedback = async () => {
    if (feedback.rating === 0) {
      enqueueSnackbar('Please give a rating', { variant: 'warning' });
      return;
    }

    setFeedbackSubmitting(true);

    const sentiment = await analyzeSentiment(feedback.comments);

    try {
      await addDoc(collection(db, 'feedback'), {
        appointmentId: selectedAppt.id,
        doctorId: selectedAppt.doctorId,
        patientId: currentUser.uid,
        rating: feedback.rating,
        comments: feedback.comments,
        sentiment,
        createdAt: new Date(),
      });

      await updateDoc(doc(db, 'appointments', selectedAppt.id), { feedbackGiven: true });

      enqueueSnackbar(`Feedback submitted! Sentiment: ${sentiment.toUpperCase()}`, {
        variant: sentiment === 'positive' ? 'success' : sentiment === 'negative' ? 'error' : 'info',
        autoHideDuration: 6000,
      });

      handleCloseDetails();

      const snap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('patientId', '==', currentUser.uid),
          orderBy('date', 'desc')
        )
      );
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      enqueueSnackbar('Failed to submit feedback', { variant: 'error' });
      console.error(err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Not set';
    try {
      return timestamp.toDate().toLocaleString();
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  // ────────────────────────────────────────────────
  // Chatbot Handler
  // ────────────────────────────────────────────────
  const handleSendChat = async () => {
  if (!chatMessage.trim()) return;

  const userMsg = { role: 'user', content: chatMessage };
  setChatHistory(prev => [...prev, userMsg]);
  setChatMessage('');
  setChatLoading(true);

  const prompt = `You are an expert Ayurvedic wellness assistant. 
Respond helpfully, safely, and accurately to this patient query: "${chatMessage}".

If the query is about symptoms, suggest possible dosha imbalance (Vata, Pitta, Kapha) and recommended therapies or lifestyle tips.
Always end every response with: "This is general information only and not a substitute for professional medical advice. Please consult a qualified Ayurvedic doctor for personalized diagnosis and treatment."

Keep answers short, clear, friendly, and in simple language. Do not give definitive diagnoses.`;

  try {
    // Use corsproxy.io (very reliable in 2025–2026)
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
    )}`;

    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!res.ok) {
      throw new Error(`Proxy / API error: ${res.status} ${res.statusText}`);
    }

    const proxyData = await res.json();
    // corsproxy.io returns { contents: actual_response_string }
    let data;
    try {
      data = JSON.parse(proxyData.contents || '{}');
    } catch {
      throw new Error("Invalid response format from proxy");
    }

    const aiReply = data[0]?.generated_text?.trim() 
      || data.generated_text?.trim() 
      || "Sorry, couldn't get a proper response from the AI.";

    setChatHistory(prev => [...prev, { role: 'ai', content: aiReply }]);
  } catch (err) {
  console.error("Full chat error:", err);

  let userMessage = "AI service is having issues right now. Please try again in 30–60 seconds.";

  if (err.message.includes("429")) {
    userMessage = "Too many requests — wait 1 minute and try again.";
  } else if (err.message.includes("401") || err.message.includes("403")) {
    userMessage = "Authentication error — check your API key in .env";
  } else if (err.message.includes("Failed to fetch") || err.message.includes("network")) {
    userMessage = "Network connection issue. Check internet / disable VPN / try mobile data.";
  } else if (err.message.includes("queue") || err.message.includes("model")) {
    userMessage = "The AI model is busy or unavailable. Trying again in a minute usually helps.";
  }

  setChatHistory(prev => [...prev, { role: 'ai', content: userMessage }]);
} finally {
    setChatLoading(false);
  }
};
  if (loading) {
    return (
      <DashboardLayout title="Patient Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Patient Dashboard">
      <Typography variant="h5" gutterBottom>
        Welcome back, {patientInfo.name || currentUser?.email.split('@')[0] || 'Patient'}!
      </Typography>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 4 }}>
        <Tab label="Book Appointment" />
        <Tab label="My Appointments" />
        <Tab label="Therapy Sessions" />
        <Tab label="Medical History" />
        <Tab label="Profile" />
        <Tab label="AI Advisor" /> {/* New Chatbot Tab */}
      </Tabs>

      {/* Book Appointment */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom color="primary">
            Book New Appointment
          </Typography>
          <Box component="form" onSubmit={handleBookAppointment}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Select Doctor"
                  name="doctorId"
                  value={bookingForm.doctorId}
                  onChange={handleBookingChange}
                  required
                >
                  {doctors.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.name} ({doc.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  type="date"
                  fullWidth
                  label="Date"
                  name="date"
                  value={bookingForm.date}
                  onChange={handleBookingChange}
                  InputProps={{ inputProps: { min: new Date().toISOString().split('T')[0] } }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Time"
                  name="time"
                  value={bookingForm.time}
                  onChange={handleBookingChange}
                  required
                >
                  {timeSlots.map((slot) => (
                    <MenuItem key={slot} value={slot}>
                      {slot}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason for Visit"
                  name="reason"
                  multiline
                  rows={3}
                  value={bookingForm.reason}
                  onChange={handleBookingChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : 'Book Appointment'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </TabPanel>

      {/* My Appointments */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>My Appointments</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Doctor</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No appointments yet</TableCell>
                </TableRow>
              ) : (
                appointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell>{new Date(appt.date).toLocaleDateString()}</TableCell>
                    <TableCell>{appt.time}</TableCell>
                    <TableCell>{appt.doctorName}</TableCell>
                    <TableCell>{appt.reason}</TableCell>
                    <TableCell><Chip label={appt.status.toUpperCase()} color={getStatusColor(appt.status)} /></TableCell>
                    <TableCell>
                      <Button variant="outlined" size="small" onClick={() => handleViewDetails(appt)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Therapy Sessions with Progress */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>Therapy Sessions Progress</Typography>
        {therapySessions.length === 0 ? (
          <Alert severity="info">No therapy sessions prescribed yet.</Alert>
        ) : (
          Object.entries(
            therapySessions.reduce((groups, session) => {
              const key = session.therapyType || 'Unknown Therapy';
              if (!groups[key]) {
                groups[key] = {
                  sessions: [],
                  total: session.totalSessions || therapySessions.filter(s => s.therapyType === key).length,
                };
              }
              groups[key].sessions.push(session);
              return groups;
            }, {})
          ).map(([therapyType, { sessions, total }]) => {
            const completed = sessions.filter(s => s.status === 'completed').length;
            const percentage = total > 0 ? (completed / total) * 100 : 0;

            return (
              <Paper key={therapyType} sx={{ p: 4, mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  {therapyType}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {total} sessions prescribed
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{ height: 12, borderRadius: 6 }}
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {completed} of {total} sessions completed ({percentage.toFixed(1)}%)
                  </Typography>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Session</TableCell>
                        <TableCell>Date & Time</TableCell>
                        <TableCell>Therapist</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>Session {session.sessionNumber || '?'}</TableCell>
                          <TableCell>{formatDateTime(session.dateTime)}</TableCell>
                          <TableCell>{session.therapistName || 'Not assigned'}</TableCell>
                          <TableCell><Chip label={session.status?.toUpperCase() || 'SCHEDULED'} color={getStatusColor(session.status)} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            );
          })
        )}
      </TabPanel>

      {/* Medical History */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>Medical History</Typography>
        {appointments.filter(a => a.status === 'completed').length === 0 ? (
          <Alert severity="info">No completed appointments yet.</Alert>
        ) : (
          appointments.filter(a => a.status === 'completed').map((appt) => (
            <Paper key={appt.id} sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1">
                {new Date(appt.date).toLocaleDateString()} - {appt.doctorName}
              </Typography>
              <Typography><strong>Prescription:</strong> {appt.prescription || 'None recorded'}</Typography>
              <Typography><strong>Therapies Prescribed:</strong></Typography>
              {appt.therapies?.length > 0 ? (
                <ul>
                  {appt.therapies.map((t, i) => (
                    <li key={i}>
                      {t.type} – {t.numSessions} sessions ({t.therapistName})
                    </li>
                  ))}
                </ul>
              ) : 'None'}
            </Paper>
          ))
        )}
      </TabPanel>

      {/* Profile */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom>My Profile</Typography>
        <Paper sx={{ p: 4, maxWidth: 600 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar sx={{ width: 100, height: 100, fontSize: 40, bgcolor: 'primary.main' }}>
                {currentUser?.email[0].toUpperCase()}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h5">
                {patientInfo.name || currentUser?.email.split('@')[0]}
              </Typography>
              <Typography color="text.secondary">{currentUser?.email}</Typography>
              <Typography color="text.secondary">
                {patientInfo.phone || 'Phone not provided'}
              </Typography>
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 4 }}>
            Contact clinic admin to update your profile details.
          </Alert>
        </Paper>
      </TabPanel>

      {/* AI Advisor Tab - Chatbot */}
      <TabPanel value={tabValue} index={5}>
        <Paper sx={{ p: 4, minHeight: '70vh' }}>
          <Typography variant="h6" gutterBottom color="primary">
            AI Wellness Advisor & Symptom Checker
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
            Ask about symptoms, therapies, dosha balance, or general Ayurvedic wellness. 
            <strong> Always consult a qualified doctor for diagnosis and treatment.</strong>
          </Typography>

          {/* Chat History Display */}
          <Box 
            sx={{ 
              height: 450, 
              overflowY: 'auto', 
              border: '1px solid #e0e0e0', 
              borderRadius: 2, 
              p: 2, 
              mb: 3, 
              bgcolor: '#fafafa' 
            }}
          >
            {chatHistory.length === 0 ? (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 15 }}>
                <Typography>Start by typing your question or describing any symptoms...</Typography>
              </Box>
            ) : (
              chatHistory.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    maxWidth: '80%',
                    ml: msg.role === 'user' ? 'auto' : 0,
                    mr: msg.role === 'ai' ? 'auto' : 0,
                    bgcolor: msg.role === 'user' ? '#e3f2fd' : '#e8f5e9',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Typography variant="subtitle2" color={msg.role === 'user' ? 'primary' : 'success.dark'}>
                    {msg.role === 'user' ? 'You' : 'Ayurvedic AI'}
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Typography>
                </Box>
              ))
            )}
          </Box>

          {/* Input Area */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="E.g., I feel tired and have headaches... What could it be?"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              disabled={chatLoading}
            />
            <Button
              variant="contained"
              onClick={handleSendChat}
              disabled={chatLoading || !chatMessage.trim()}
              sx={{ minWidth: 120 }}
            >
              {chatLoading ? <CircularProgress size={24} /> : 'Send'}
            </Button>
          </Box>
        </Paper>
      </TabPanel>

      {/* Appointment Details & Feedback Modal */}
      <Dialog open={!!selectedAppt} onClose={handleCloseDetails} maxWidth="sm" fullWidth>
        <DialogTitle>Appointment Details</DialogTitle>
        <DialogContent dividers>
          {selectedAppt && (
            <>
              <Typography><strong>Date:</strong> {new Date(selectedAppt.date).toLocaleDateString()}</Typography>
              <Typography><strong>Time:</strong> {selectedAppt.time}</Typography>
              <Typography><strong>Doctor:</strong> {selectedAppt.doctorName}</Typography>
              <Typography><strong>Status:</strong> <Chip label={selectedAppt.status.toUpperCase()} color={getStatusColor(selectedAppt.status)} /></Typography>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1"><strong>Doctor's Prescription:</strong></Typography>
                <Typography>{selectedAppt.prescription || 'Not added yet'}</Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1"><strong>Prescribed Therapies:</strong></Typography>
                {selectedAppt.therapies?.length > 0 ? (
                  <ul>
                    {selectedAppt.therapies.map((t, i) => (
                      <li key={i}>
                        {t.type} – {t.numSessions} sessions ({t.therapistName})
                      </li>
                    ))}
                  </ul>
                ) : <Typography>None prescribed</Typography>}
              </Box>

              {selectedAppt.status === 'completed' && !selectedAppt.feedbackGiven && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6">Rate Your Experience</Typography>
                  <Rating
                    value={feedback.rating}
                    onChange={(_, val) => setFeedback({ ...feedback, rating: val })}
                    size="large"
                  />
                  <TextField
                    fullWidth
                    label="Comments (optional)"
                    multiline
                    rows={3}
                    value={feedback.comments}
                    onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
                    sx={{ mt: 2 }}
                  />
                  <Button 
                    variant="contained" 
                    onClick={handleSubmitFeedback} 
                    sx={{ mt: 2 }}
                    disabled={feedbackSubmitting}
                  >
                    {feedbackSubmitting ? <CircularProgress size={24} /> : 'Submit Feedback'}
                  </Button>
                </Box>
              )}

              {selectedAppt.feedbackGiven && (
                <Alert severity="success" sx={{ mt: 3 }}>
                  Thank you! Your feedback has been submitted.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default PatientDashboard;