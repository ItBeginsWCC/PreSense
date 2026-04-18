import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DispatchView = () => {
  const [note, setNote] = useState('');
  const [incident, setIncident] = useState<any>(null);
  const navigate = useNavigate();

  const handleCreateIncident = async () => {
    try {
      console.log('Attempting to create incident with note:', note);
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchNote: note })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Incident created successfully:', data);
      setIncident(data);
    } catch (error) {
      console.error('Failed to create incident:', error);
      alert('Error: Could not connect to the backend server. Make sure it is running on port 3001.');
    }
  };

  return (
    <div className="view-container dispatch-view">
      <h1>Dispatch Simulator</h1>
      <div className="card">
        <textarea 
          placeholder="Enter initial 911 dispatch notes..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button onClick={handleCreateIncident}>Create & Send Link</button>
      </div>

      {incident && (
        <div className="incident-links card">
          <h3>Incident Created: {incident.id}</h3>
          <p>
            <strong>Caller Link:</strong> 
            <a href={`/incident/${incident.id}`} target="_blank">View Caller Interface</a>
          </p>
          <p>
            <strong>EMT Dashboard:</strong> 
            <a href={`/emt/${incident.id}`} target="_blank">View EMT Dashboard</a>
          </p>
        </div>
      )}
    </div>
  );
};

export default DispatchView;
