import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, IconButton, Badge, Tooltip, Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider, InputBase, CircularProgress } from '@mui/material';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { vendorAPI } from '../api';
import toast from 'react-hot-toast';

export default function AdminGlobalChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChats, setActiveChats] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // View state: null means showing list, object means showing specific chat
    const [currentChat, setCurrentChat] = useState(null);

    // Chat specific state
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef();

    // Fetch list of active chats
    const fetchActiveChats = async () => {
        try {
            const res = await vendorAPI.getActiveChats();
            setActiveChats(res.data);
        } catch (err) {
            console.error('Failed to load active chats', err);
        }
    };

    // Load active chats when opened or periodically
    useEffect(() => {
        if (isOpen && !currentChat) {
            fetchActiveChats();
        }
        
        // Poll every 10 seconds for new messages in list view
        const interval = setInterval(() => {
            if (!currentChat) fetchActiveChats();
        }, 10000);
        return () => clearInterval(interval);
    }, [isOpen, currentChat]);

    // Fetch messages for a specific chat
    const fetchMessages = async (orderId, showLoading = false) => {
        if (showLoading) setChatLoading(true);
        try {
            const res = await vendorAPI.getMessages(orderId);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            if (showLoading) setChatLoading(false);
        }
    };

    // Handle opening a chat
    useEffect(() => {
        if (currentChat) {
            fetchMessages(currentChat.order._id, true);
            // Mark as read when opened
            vendorAPI.markAsRead(currentChat.order._id).then(() => fetchActiveChats());
            
            const interval = setInterval(() => fetchMessages(currentChat.order._id), 5000);
            return () => clearInterval(interval);
        }
    }, [currentChat]);

    // Auto-scroll chat
    useEffect(() => {
        if (scrollRef.current && currentChat) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, currentChat]);

    const handleSend = async () => {
        if (!input.trim() || sending || !currentChat) return;
        setSending(true);
        try {
            const res = await vendorAPI.sendMessage(currentChat.order._id, input);
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) {
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });

    // Calculate total unread count
    const totalUnread = activeChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);

    return (
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
            
            {/* The Chat Panel */}
            {isOpen && (
                <Paper 
                    elevation={12} 
                    sx={{ 
                        position: 'absolute', bottom: 70, right: 0, 
                        width: 350, height: 500, borderRadius: 4, 
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        animation: 'chatFadeIn 0.2s ease-out',
                        '@keyframes chatFadeIn': {
                            from: { opacity: 0, transform: 'translateY(20px)' },
                            to: { opacity: 1, transform: 'translateY(0)' }
                        }
                    }}
                >
                    {/* Header */}
                    <Box sx={{ 
                        p: 2, bgcolor: '#0f172a', color: 'white', 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {currentChat && (
                                <IconButton size="small" onClick={() => setCurrentChat(null)} sx={{ color: 'white', mr: 1 }}>
                                    <ArrowBackIcon fontSize="small" />
                                </IconButton>
                            )}
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {currentChat ? `Order #${currentChat.order.orderId}` : 'Vendor Messages'}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setIsOpen(false)} sx={{ color: '#94a3b8', '&:hover': { color: 'white' } }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Body */}
                    <Box sx={{ flex: 1, bgcolor: '#f8fafc', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* VIEW 1: LIST OF CHATS */}
                        {!currentChat && (
                            <List sx={{ p: 0 }}>
                                {activeChats.length === 0 ? (
                                    <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                                        No active vendor conversations.
                                    </Box>
                                ) : (
                                    activeChats.map((chat, idx) => (
                                        <React.Fragment key={chat.order._id}>
                                            <ListItem 
                                                button 
                                                onClick={() => setCurrentChat(chat)}
                                                sx={{ 
                                                    '&:hover': { bgcolor: '#f1f5f9' },
                                                    p: 2,
                                                    bgcolor: chat.unreadCount > 0 ? 'rgba(59, 130, 246, 0.04)' : 'transparent'
                                                }}
                                            >
                                                <ListItemAvatar>
                                                    <Badge 
                                                        color="error" 
                                                        badgeContent={chat.unreadCount} 
                                                        invisible={chat.unreadCount === 0}
                                                        sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
                                                    >
                                                        <Avatar sx={{ bgcolor: '#f97316', fontWeight: 'bold' }}>
                                                            {chat.order.vendorId?.name?.charAt(0).toUpperCase() || 'V'}
                                                        </Avatar>
                                                    </Badge>
                                                </ListItemAvatar>
                                                <ListItemText 
                                                    primary={
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: chat.unreadCount > 0 ? 800 : 600, color: '#0f172a' }}>
                                                                {chat.order.vendorId?.name || 'Unknown Vendor'}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: chat.unreadCount > 0 ? '#3b82f6' : '#94a3b8', fontWeight: chat.unreadCount > 0 ? 700 : 400 }}>
                                                                {formatDate(chat.latestMessage.createdAt)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box sx={{ mt: 0.5 }}>
                                                            <Typography variant="caption" sx={{ display: 'block', color: '#3b82f6', fontWeight: 600, mb: 0.5 }}>
                                                                Order #{chat.order.orderId}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ 
                                                                color: chat.unreadCount > 0 ? '#1e293b' : '#64748b', 
                                                                fontWeight: chat.unreadCount > 0 ? 600 : 400,
                                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                                                            }}>
                                                                <strong style={{ color: '#475569' }}>{chat.latestMessage.role === 'admin' ? 'You: ' : ''}</strong>
                                                                {chat.latestMessage.text}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                            {idx < activeChats.length - 1 && <Divider component="li" />}
                                        </React.Fragment>
                                    ))
                                )}
                            </List>
                        )}

                        {/* VIEW 2: SPECIFIC CHAT */}
                        {currentChat && (
                            <>
                                <Box ref={scrollRef} sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Box sx={{ fontSize: 11, textAlign: 'center', color: '#64748b', bgcolor: '#e2e8f0', p: 0.5, borderRadius: 1, mx: 'auto', mb: 1 }}>
                                        Chatting with <strong>{currentChat.order.vendorId?.name}</strong>
                                    </Box>

                                    {chatLoading ? (
                                        <Box sx={{ textAlign: 'center', p: 4, color: '#94a3b8' }}><CircularProgress size={24} /></Box>
                                    ) : messages.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', p: 4, color: '#94a3b8', fontStyle: 'italic' }}>No messages yet.</Box>
                                    ) : (() => {
                                        let lastDate = '';
                                        return messages.map(msg => {
                                            const msgDate = formatDate(msg.createdAt);
                                            const showDate = msgDate !== lastDate;
                                            lastDate = msgDate;
                                            const isMe = msg.role === 'admin';

                                            return (
                                                <React.Fragment key={msg._id}>
                                                    {showDate && <Box sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', py: 0.5 }}>{msgDate}</Box>}
                                                    <Box sx={{ display: 'flex', width: '100%', mb: 0.5, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                        <Box sx={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', fontSize: 11 }}>{isMe ? 'You' : currentChat.order.vendorId?.name}</Typography>
                                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 10 }}>{formatTime(msg.createdAt)}</Typography>
                                                            </Box>
                                                            <Box sx={{
                                                                p: 1.5, fontSize: 13, lineHeight: 1.4, borderRadius: 3,
                                                                bgcolor: isMe ? '#3b82f6' : 'white',
                                                                color: isMe ? 'white' : '#0f172a',
                                                                border: isMe ? 'none' : '1px solid #e2e8f0',
                                                                borderBottomRightRadius: isMe ? 4 : 12,
                                                                borderBottomLeftRadius: isMe ? 12 : 4
                                                            }}>
                                                                {msg.text}
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </Box>

                                {/* Input Area */}
                                <Box sx={{ p: 1.5, bgcolor: 'white', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <InputBase
                                        placeholder="Type a reply..."
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                                        disabled={sending}
                                        sx={{ flex: 1, bgcolor: '#f1f5f9', px: 2, py: 1, borderRadius: 20, fontSize: 13 }}
                                    />
                                    <IconButton 
                                        onClick={handleSend} 
                                        disabled={!input.trim() || sending} 
                                        sx={{ 
                                            bgcolor: '#3b82f6', color: 'white', width: 36, height: 36, 
                                            '&:hover': { bgcolor: '#2563eb' }, 
                                            '&.Mui-disabled': { bgcolor: '#93c5fd', color: 'white' } 
                                        }}
                                    >
                                        <SendIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Box>
                            </>
                        )}
                    </Box>
                </Paper>
            )}

            {/* Floating Action Button */}
            <Tooltip title="Vendor Messages" placement="left">
                <IconButton
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (isOpen) setCurrentChat(null); // Reset view on close
                        if (!isOpen) fetchActiveChats();  // Fetch on open
                    }}
                    sx={{
                        bgcolor: '#0f172a',
                        color: 'white',
                        width: 56,
                        height: 56,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        '&:hover': { bgcolor: '#1e293b' },
                        transition: 'transform 0.2s',
                        transform: isOpen ? 'scale(0.9)' : 'scale(1)'
                    }}
                >
                    <Badge badgeContent={totalUnread} color="error" overlap="circular">
                        {isOpen ? <CloseIcon /> : <ChatBubbleIcon />}
                    </Badge>
                </IconButton>
            </Tooltip>
        </Box>
    );
}
