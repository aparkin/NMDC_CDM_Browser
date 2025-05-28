import React, { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Science as ScienceIcon,
  Biotech as BiotechIcon,
  Category as CategoryIcon,
  Collections as CollectionsIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';

const drawerWidth = 240;

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handlePermanentDrawerToggle = () => {
    setOpen(!open);
  };

  // Extract studyId and sampleId from the current path
  const pathParts = location.pathname.split('/');
  const studyId = pathParts[2]; // /studies/:studyId
  const sampleId = pathParts[4]; // /studies/:studyId/samples/:sampleId

  const menuItems = [
    {
      text: 'Studies',
      icon: <ScienceIcon />,
      path: '/',
      children: [
        {
          text: 'Study Dashboard',
          icon: <CategoryIcon />,
          path: `/studies/${studyId}`,
          hidden: !studyId // Only hide if we're not in a study context
        },
        {
          text: 'Sample Detail',
          icon: <BiotechIcon />,
          path: `/studies/${studyId}/samples/${sampleId}`,
          hidden: !sampleId // Only show when viewing a sample
        }
      ]
    },
    {
      text: 'Study Sets',
      icon: <CollectionsIcon />,
      path: '/set'
    }
  ];

  const renderMenuItems = (items: typeof menuItems) => {
    return items.map((item) => (
      <React.Fragment key={item.text}>
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to={item.path}
            selected={location.pathname === item.path}
            sx={{
              minHeight: 48,
              justifyContent: open ? 'initial' : 'center',
              px: 2.5,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: open ? 3 : 'auto',
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.text} 
              sx={{ 
                opacity: open ? 1 : 0,
                display: open ? 'block' : 'none'
              }} 
            />
          </ListItemButton>
        </ListItem>
        {item.children && open && item.children.map((child) => {
          // Only show child items if they're not hidden
          if (child.hidden) return null;

          return (
            <ListItem key={child.text} disablePadding>
              <ListItemButton
                component={Link}
                to={child.path}
                selected={location.pathname === child.path}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  pl: 4, // Indent child items
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {child.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={child.text} 
                  sx={{ 
                    opacity: open ? 1 : 0,
                    display: open ? 'block' : 'none'
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </React.Fragment>
    ));
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            edge="start"
            onClick={handlePermanentDrawerToggle}
            sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            NMDC CDM Browser
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {renderMenuItems(menuItems)}
            </List>
          </Box>
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open={open}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {renderMenuItems(menuItems)}
            </List>
          </Box>
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxWidth: { sm: `calc(100vw - ${drawerWidth}px)` }
        }}
      >
        <Toolbar />
        <Box sx={{ 
          flex: 1,
          width: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout; 