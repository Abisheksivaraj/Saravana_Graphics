import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../api';

const RegisterCheck = ({ children }) => {
    const [status, setStatus] = useState({ loading: true, enabled: true });

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await axios.get(`${BASE_URL}/api/auth/registration-status`);
                setStatus({ loading: false, enabled: response.data.registrationEnabled });
            } catch (error) {
                console.error('Failed to check registration status:', error);
                setStatus({ loading: false, enabled: false });
            }
        };
        checkStatus();
    }, []);

    if (status.loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                backgroundColor: '#0f172a',
                color: 'white'
            }}>
                Loading...
            </div>
        );
    }

    if (!status.enabled) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default RegisterCheck;
