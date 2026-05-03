import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Radio, RadioGroup, FormControlLabel, FormControl, Button } from '@mui/material';
import toast from 'react-hot-toast';

export default function Settings() {
    const [layout, setLayout] = useState('sidebar');

    useEffect(() => {
        const savedLayout = localStorage.getItem('vendorLayoutPreference');
        if (savedLayout) {
            setLayout(savedLayout);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('vendorLayoutPreference', layout);
        toast.success('Layout saved! The app will now reload to apply the changes.');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>Settings</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>Customize your Vendor Portal experience</Typography>

            <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0', maxWidth: 600 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>Application Layout</Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                    Choose how you want the navigation menu to appear.
                </Typography>

                <FormControl component="fieldset" sx={{ width: '100%', mb: 4 }}>
                    <RadioGroup
                        value={layout}
                        onChange={(e) => setLayout(e.target.value)}
                    >
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <Paper 
                                    elevation={0} 
                                    sx={{ 
                                        p: 2, 
                                        border: layout === 'sidebar' ? '2px solid #f97316' : '1px solid #e2e8f0',
                                        bgcolor: layout === 'sidebar' ? '#fff7ed' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': { borderColor: '#f97316' }
                                    }}
                                    onClick={() => setLayout('sidebar')}
                                >
                                    <FormControlLabel 
                                        value="sidebar" 
                                        control={<Radio color="primary" />} 
                                        label={<Typography sx={{ fontWeight: 600 }}>Sidebar Layout</Typography>} 
                                        sx={{ m: 0, width: '100%' }}
                                    />
                                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1, ml: 4 }}>
                                        Navigation links appear on the left side of the screen.
                                    </Typography>
                                </Paper>
                            </Grid>
                            
                            <Grid item xs={12} sm={6}>
                                <Paper 
                                    elevation={0} 
                                    sx={{ 
                                        p: 2, 
                                        border: layout === 'navbar' ? '2px solid #f97316' : '1px solid #e2e8f0',
                                        bgcolor: layout === 'navbar' ? '#fff7ed' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': { borderColor: '#f97316' }
                                    }}
                                    onClick={() => setLayout('navbar')}
                                >
                                    <FormControlLabel 
                                        value="navbar" 
                                        control={<Radio color="primary" />} 
                                        label={<Typography sx={{ fontWeight: 600 }}>Top Navbar Layout</Typography>} 
                                        sx={{ m: 0, width: '100%' }}
                                    />
                                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1, ml: 4 }}>
                                        Navigation links appear at the top of the screen.
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </RadioGroup>
                </FormControl>

                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSave}
                    sx={{ px: 4, py: 1.5 }}
                >
                    Save Layout
                </Button>
            </Paper>
        </Box>
    );
}
