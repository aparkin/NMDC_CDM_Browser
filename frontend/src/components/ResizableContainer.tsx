import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface ResizableContainerProps {
  title: string;
  children: React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  defaultCollapsed?: boolean;
  onResize?: (height: number) => void;
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  title,
  children,
  defaultHeight = 400,
  minHeight = 200,
  maxHeight = 800,
  defaultCollapsed = false,
  onResize,
}) => {
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    setIsDragging(true);
    setStartY(e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const newHeight = Math.min(maxHeight, Math.max(minHeight, height + deltaY));
    setHeight(newHeight);
    onResize?.(newHeight);
    setStartY(e.clientY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, height]);

  return (
    <Paper 
      elevation={3}
      sx={{ 
        height: isCollapsed ? 'auto' : height,
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s ease',
        overflow: 'hidden'
      }}
    >
      <Box 
        sx={{ 
          p: 1, 
          borderBottom: 1, 
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          size="small"
          sx={{ color: 'primary.main' }}
        >
          {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </Box>
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 2,
          display: isCollapsed ? 'none' : 'block',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
        }}
      >
        {children}
      </Box>
      {!isCollapsed && (
        <Box
          sx={{
            height: '8px',
            bgcolor: isDragging ? 'primary.main' : 'divider',
            cursor: 'ns-resize',
            '&:hover': { 
              bgcolor: 'primary.main',
              height: '12px'
            },
            transition: 'all 0.2s ease'
          }}
          onMouseDown={handleMouseDown}
        />
      )}
    </Paper>
  );
}; 