import React from 'react';
import { Backdrop, Box, CircularProgress } from '@mui/material';

const LoadingBackdrop = ({ isLoading }) => {
  const isLoadingBool = Boolean(isLoading);
  return (
    <Backdrop
      sx={{
        backgroundColor: 'rgba(200, 200, 200, 0.2)',
        color: '#000',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      open={isLoadingBool}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#fff',
          padding: '10px',
          borderRadius: '50%',
          boxShadow: 'rgba(100, 100, 111, 0.2) 0px 7px 29px 0px',
        }}
      >
        <CircularProgress color="inherit" />
      </Box>
    </Backdrop>
  );
};

export default LoadingBackdrop;
