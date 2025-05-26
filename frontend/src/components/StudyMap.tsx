import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { MapContainer as LeafletMap, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';

/**
 * StudyMap Component
 * 
 * A React component that displays a map showing study locations and their associated sample points.
 * Uses Leaflet for map rendering and MarkerCluster for efficient marker management.
 * 
 * Features:
 * - Interactive map with study locations and sample points
 * - Color-coded markers for different studies
 * - Clustering of markers for better performance
 * - Popups with study and sample information
 * - Automatic bounds fitting to show all markers
 */

// Fix for default marker icons in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Study {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sample_count: number;
  ecosystem?: string;
  ecosystem_type?: string;
  ecosystem_subtype?: string;
  depth?: number;
  temperature?: number;
  ph?: number;
  salinity?: number;
}

interface StudyMapProps {
  studies: Study[];
  center?: [number, number];
}

export const StudyMap: React.FC<StudyMapProps> = ({ studies, center }) => {
  const defaultCenter: [number, number] = center || [0, 0];
  const defaultZoom = 2;
  const mapRef = useRef<L.Map | null>(null);
  const markerClusterRef = useRef<L.MarkerClusterGroup | null>(null);

  // Generate consistent colors based on study ID
  const getStudyColor = (studyId: string) => {
    const colors = [
      '#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9',
      '#bbdefb', '#e3f2fd', '#1565c0', '#0d47a1', '#1e88e5'
    ];
    const hash = studyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
    }

    // Create marker cluster group
    const markerCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      // Custom cluster icon
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const markers = cluster.getAllChildMarkers();
        const count = markers.length;
        
        return L.divIcon({
          html: `<div style="background-color: #1976d2; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            <span style="font-weight: bold; font-size: 14px;">${count}</span>
            <small style="font-size: 8px;">studies</small>
          </div>`,
          className: 'marker-cluster',
          iconSize: L.point(40, 40)
        });
      }
    });

    // Add markers to cluster
    studies.forEach((study) => {
      const marker = L.circleMarker([study.latitude, study.longitude], {
        radius: Math.max(5, Math.min(15, Math.log(study.sample_count + 1) * 3)),
        fillColor: getStudyColor(study.id),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });

      // Create popup content with all available information
      const popupContent = `
        <div style="min-width: 200px;">
          <strong>Study:</strong> ${study.name}<br />
          <strong>Samples:</strong> ${study.sample_count}<br />
          <strong>Coordinates:</strong> ${study.latitude.toFixed(4)}, ${study.longitude.toFixed(4)}
          ${study.ecosystem ? `<br /><strong>Ecosystem:</strong> ${study.ecosystem}` : ''}
          ${study.ecosystem_type ? `<br /><strong>Ecosystem Type:</strong> ${study.ecosystem_type}` : ''}
          ${study.ecosystem_subtype ? `<br /><strong>Ecosystem Subtype:</strong> ${study.ecosystem_subtype}` : ''}
          ${study.depth !== undefined ? `<br /><strong>Depth:</strong> ${study.depth}m` : ''}
          ${study.temperature !== undefined ? `<br /><strong>Temperature:</strong> ${study.temperature}°C` : ''}
          ${study.ph !== undefined ? `<br /><strong>pH:</strong> ${study.ph}` : ''}
          ${study.salinity !== undefined ? `<br /><strong>Salinity:</strong> ${study.salinity}‰` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add hover tooltip
      marker.bindTooltip(`${study.name} (${study.sample_count} samples)`);

      markerCluster.addLayer(marker);
    });

    // Add cluster group to map
    mapRef.current.addLayer(markerCluster);
    markerClusterRef.current = markerCluster;

    // Fit map to markers if we have any
    if (studies.length > 0) {
      const group = L.featureGroup(markerCluster.getLayers());
      mapRef.current.fitBounds(group.getBounds().pad(0.005));
    }

    // Cleanup
    return () => {
      if (markerClusterRef.current) {
        markerClusterRef.current.clearLayers();
        markerClusterRef.current = null;
      }
    };
  }, [studies]);

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <LeafletMap
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      </LeafletMap>
    </Box>
  );
}; 