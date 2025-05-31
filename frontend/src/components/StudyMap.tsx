import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Study } from '../types';
import { configureLeafletIcons, defaultClusterOptions, getStudyColor, mapStyles } from '../utils/mapConfig';

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

interface StudyMapProps {
  studies: Study[];
  onStudyClick?: (study: Study) => void;
  selectedStudyId?: string;
}

const StudyMap: React.FC<StudyMapProps> = ({ studies, onStudyClick, selectedStudyId }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Add resize handler
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Configure Leaflet icons
    configureLeafletIcons();

    // Initialize map if not already initialized
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);

      // Add custom styles
      const styleSheet = document.createElement('style');
      styleSheet.textContent = mapStyles;
      document.head.appendChild(styleSheet);

      // Initialize marker cluster group
      markersRef.current = L.markerClusterGroup(defaultClusterOptions);
      mapRef.current.addLayer(markersRef.current);
    }

    // Clear existing markers
    if (markersRef.current) {
      markersRef.current.clearLayers();
    }

    // Add markers for each study
    studies.forEach(study => {
      if (study.latitude && study.longitude && markersRef.current && mapRef.current) {
        const color = getStudyColor(study.id);
        const marker = L.circleMarker([study.latitude, study.longitude], {
          radius: 8,
          color: color,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        });

        // Add popup with study information
        const popupContent = `
          <div style="font-family: Arial, sans-serif; padding: 8px;">
            <h3 style="margin: 0 0 8px 0; color: #333;">${study.name}</h3>
            <p style="margin: 0 0 4px 0; color: #666;">ID: ${study.id}</p>
            ${study.description ? `<p style="margin: 0 0 4px 0; color: #666;">${study.description}</p>` : ''}
            ${study.ecosystem ? `<p style="margin: 0 0 4px 0; color: #666;">Ecosystem: ${study.ecosystem}</p>` : ''}
            ${study.ecosystem_category ? `<p style="margin: 0 0 4px 0; color: #666;">Category: ${study.ecosystem_category}</p>` : ''}
            ${study.ecosystem_subtype ? `<p style="margin: 0 0 4px 0; color: #666;">Subtype: ${study.ecosystem_subtype}</p>` : ''}
            ${study.ecosystem_type ? `<p style="margin: 0 0 4px 0; color: #666;">Type: ${study.ecosystem_type}</p>` : ''}
            ${study.specific_ecosystem ? `<p style="margin: 0 0 4px 0; color: #666;">Specific: ${study.specific_ecosystem}</p>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add click handler if provided
        if (onStudyClick) {
          marker.on('click', () => onStudyClick(study));
        }

        // Highlight selected study
        if (study.id === selectedStudyId) {
          marker.setStyle({
            radius: 12,
            weight: 3,
            fillOpacity: 1
          });
        }

        markersRef.current.addLayer(marker);
      }
    });

    // Fit map to markers if there are any
    if (markersRef.current && markersRef.current.getLayers().length > 0 && mapRef.current) {
      // Use setTimeout to ensure the map is fully initialized
      setTimeout(() => {
        if (mapRef.current && markersRef.current) {
          mapRef.current.fitBounds(markersRef.current.getBounds(), {
            padding: [50, 50]
          });
        }
      }, 100);
    }

    // Cleanup
    return () => {
      if (markersRef.current) {
        markersRef.current.clearLayers();
        markersRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [studies, onStudyClick, selectedStudyId]);

  return (
    <div 
      ref={mapContainerRef}
      style={{ 
        height: '100%', 
        width: '100%',
        minHeight: '300px'
      }} 
    />
  );
};

export { StudyMap }; 