import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const socket = io();

const EmtView = () => {
  const { id } = useParams();
  const [incident, setIncident] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/incidents/${id}`)
        .then(res => res.json())
        .then(data => setIncident(data));

      socket.emit('join-incident', id);

      socket.on('summary-update', (summary) => {
        setIncident((prev: any) => ({
          ...prev,
          summary
        }));
      });

      socket.on('incident-resolved', () => {
        setIncident((prev: any) => ({
          ...prev,
          status: 'resolved'
        }));
        setIsResolving(false);
      });
    }

    return () => {
      socket.off('summary-update');
      socket.off('incident-resolved');
    };
  }, [id]);

  const handleEmtArrived = () => {
    setIsResolving(true);
    socket.emit('resolve-incident', id);
  };

  if (!incident) return <div>Loading EMT Dashboard...</div>;

  return (
    <div className="view-container emt-view">
      <div className="header">
        <h1>EMT RESPONDER DASHBOARD</h1>
        <div className="header-actions">
          {incident.status === 'active' ? (
            <button 
              className="arrival-btn" 
              onClick={handleEmtArrived}
              disabled={isResolving}
            >
              {isResolving ? 'GENERATING HANDOFF...' : '🚨 EMT ARRIVED'}
            </button>
          ) : (
            <span className="resolved-badge">INCIDENT RESOLVED - CARE TRANSFERRED</span>
          )}
          <div className={`triage-banner ${incident.summary?.priority || 'UNKNOWN'}`}>
            PRIORITY: {incident.summary?.priority || 'UNKNOWN'}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card medic-report">
          <h2>Medic Report</h2>
          <div className="report-content">
            {(incident.summary?.report || '').split('\n').map((line: string, i: number) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <div className="card dispatch-notes">
          <h2>Original Dispatch</h2>
          <p>{incident.dispatchNote}</p>
        </div>
      </div>

      <div className="card assessment-log">
        <h2>Live Assessment Log</h2>
        <div className="log-entries">
          {incident.questions.map((q: any, i: number) => (
            <div key={i} className={`log-entry ${q.role}`}>
              <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
              <strong>{q.role === 'ai' ? 'AI Assessment' : 'Caller'}:</strong> {q.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmtView;
