import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ShieldCheck, X, Paperclip, Loader2 } from 'lucide-react';
import { vendorAPI } from '../api';
import toast from 'react-hot-toast';
import './OrderChat.css';

export default function OrderChat({ order, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef();

    const fetchMessages = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await vendorAPI.getMessages(order._id);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages(true);
        // Polling for updates every 5 seconds
        const interval = setInterval(() => fetchMessages(), 5000);
        return () => clearInterval(interval);
    }, [order._id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        
        setSending(true);
        try {
            const res = await vendorAPI.sendMessage(order._id, input);
            setMessages([...messages, res.data]);
            setInput('');
        } catch (err) {
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="order-chat-overlay" onClick={onClose}>
            <div className="order-chat-window" onClick={e => e.stopPropagation()}>
                <div className="oc-header">
                    <div className="oc-title">
                        <div className="oc-avatar-group">
                            <div className="oc-avatar admin"><ShieldCheck size={14} /></div>
                            <div className="oc-avatar vendor"><User size={14} /></div>
                        </div>
                        <div>
                            <h3>Order Support</h3>
                            <span>#{order.orderId} • Private Channel</span>
                        </div>
                    </div>
                    <button className="oc-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="oc-messages" ref={scrollRef}>
                    <div className="oc-notice">
                        This is a private conversation between you and the Admin regarding this specific order.
                    </div>
                    
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                            <Loader2 className="animate-spin mb-2" />
                            <span className="text-xs">Loading conversation...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center p-8 text-gray-400 italic text-sm">
                            No messages yet. Start the conversation!
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg._id} className={`oc-msg-row ${msg.role}`}>
                                <div className="oc-msg-bubble">
                                    <div className="oc-msg-info">
                                        <span className="oc-sender">{msg.role === 'admin' ? 'Admin' : 'You'}</span>
                                        <span className="oc-time">{formatTime(msg.createdAt)}</span>
                                    </div>
                                    <div className="oc-msg-text">{msg.text}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="oc-input-area">
                    <button className="oc-attach-btn"><Paperclip size={20} /></button>
                    <input 
                        type="text" 
                        placeholder="Type a message..." 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={sending}
                    />
                    <button className="oc-send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
                        {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
