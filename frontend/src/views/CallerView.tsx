import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const socket = io();

const CallerView = () => {
  const { id } = useParams();
  const [incident, setIncident] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      // Fetch initial state
      fetch(`/api/incidents/${id}`)
        .then(res => res.json())
        .then(data => {
          setIncident(data);
          // If no questions yet, trigger the first one by "starting"
          if (data.questions.length === 0) {
            socket.emit('submit-answer', { id, answer: 'START ASSESSMENT' });
          }
        });

      socket.emit('join-incident', id);

      socket.on('next-question', (question) => {
        setIncident((prev: any) => ({
          ...prev,
          questions: [...(prev?.questions || []), { role: 'ai', text: question }]
        }));
        setLoading(false);
      });
    }

    return () => {
      socket.off('next-question');
    };
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setLoading(true);
    socket.emit('submit-answer', { id, answer });
    setIncident((prev: any) => ({
      ...prev,
      questions: [...(prev?.questions || []), { role: 'user', text: answer }]
    }));
    setAnswer('');
  };

  if (!incident) return <div>Loading assessment...</div>;

  const currentQuestion = incident.questions.filter((q: any) => q.role === 'ai').slice(-1)[0];

  return (
    <div className="view-container caller-view">
      <div className="header">
        <h2>Emergency Support</h2>
        <p className="status-badge">Live with Dispatch</p>
      </div>

      <div className="question-card card">
        {loading ? (
          <p className="loading-text">Analyzing your response...</p>
        ) : (
          <h3>{currentQuestion?.text || 'Connecting to EMT assessment...'}</h3>
        )}
      </div>

      <form onSubmit={handleSubmit} className="answer-form">
        <input 
          autoFocus
          type="text" 
          placeholder="Type your answer here..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>Send Answer</button>
      </form>

      <div className="history">
        <h4>Recent Chat History</h4>
        {incident.questions.slice(-4).map((q: any, i: number) => (
          <div key={i} className={`msg ${q.role}`}>
            <strong>{q.role === 'ai' ? 'Dispatcher' : 'You'}:</strong> {q.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CallerView;
