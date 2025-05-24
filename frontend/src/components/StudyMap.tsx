import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, CircularProgress } from '@mui/material';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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

// Fix for default marker icons in Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Color-blind friendly color palette (from ColorBrewer)
const COLORS = [
  '#1f77b4', // Blue
  '#ff7f0e', // Orange
  '#2ca02c', // Green
  '#d62728', // Red
  '#9467bd', // Purple
  '#8c564b', // Brown
  '#e377c2', // Pink
  '#7f7f7f', // Gray
  '#bcbd22', // Yellow-Green
  '#17becf', // Cyan
];

/**
 * Generates a consistent color for a study based on its ID
 * @param studyId - The unique identifier for the study
 * @returns A hex color code from the COLORS array
 */
const getStudyColor = (studyId: string): string => {
  const idNum = parseInt(studyId.replace(/\D/g, ''), 10);
  return COLORS[idNum % COLORS.length];
};

interface ExtendedMarker extends L.CircleMarker {
  studyId?: string;
  studyName?: string;
  studyColor?: string;
}

interface StudyLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sample_count: number;
  ecosystem: string;
  measurement_types: string[];
  lipidomics_processed: number;
  mags_analysis: number;
  metabolomics_processed: number;
  metagenome_processed: number;
  metatranscriptome_processed: number;
  nom_analysis: number;
  proteomics_processed: number;
  read_based_analysis: number;
  reads_qc: number;
  sample_locations: { latitude: number; longitude: number }[];
}

interface StudyMapProps {
  studies: StudyLocation[];
}

const StudyMap: React.FC<StudyMapProps> = ({ studies }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerCluster = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef<ExtendedMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    let mapInstance: L.Map | null = null;
    let markerClusterInstance: L.MarkerClusterGroup | null = null;

    try {
      // Initialize map with a slight delay to ensure container is ready
      setTimeout(() => {
        if (!mapContainer.current) return;

        // Initialize map if not already initialized
        if (!map.current) {
          mapInstance = L.map(mapContainer.current, {
            center: [37.0902, -95.7129],
            zoom: 3,
            zoomControl: true,
            attributionControl: true
          });
          map.current = mapInstance;

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(mapInstance);

          // Initialize marker cluster group
          markerClusterInstance = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 10,
            // Custom cluster icon
            iconCreateFunction: (cluster: L.MarkerCluster) => {
              const markers = cluster.getAllChildMarkers();
              const count = markers.length;
              const studyIds = new Set(markers.map(m => (m as any).studyId));
              
              // Get the most common study color in the cluster
              const studyColors = markers.map(m => (m as any).studyColor);
              const colorCounts: Record<string, number> = studyColors.reduce((acc, color) => {
                if (typeof color === 'string') {
                  acc[color] = (acc[color] || 0) + 1;
                }
                return acc;
              }, {} as Record<string, number>);
              
              const dominantColor = Object.entries(colorCounts)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || COLORS[0];
              
              return L.divIcon({
                html: `<div style="background-color: ${dominantColor}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                  <span style="font-weight: bold; font-size: 14px;">${studyIds.size}</span>
                  <small style="font-size: 8px;">${count} samples</small>
                </div>`,
                className: 'marker-cluster',
                iconSize: L.point(40, 40)
              });
            }
          });
          markerCluster.current = markerClusterInstance;
        }

        // Clear existing markers
        if (markerCluster.current) {
          markerCluster.current.clearLayers();
        }
        markers.current = [];

        // Group samples by study
        const studyGroups = new Map<string, StudyLocation[]>();
        studies.forEach(study => {
          if (study.sample_locations && study.sample_locations.length > 0) {
            studyGroups.set(study.id, [study]);
          }
        });

        // Add markers for each study group
        studyGroups.forEach((studyGroup, studyId) => {
          const study = studyGroup[0];
          const color = getStudyColor(study.id);
          
          // Create study center marker
          const studyMarker = L.circleMarker([study.latitude, study.longitude], {
            radius: Math.max(5, Math.min(15, Math.log(study.sample_count + 1) * 3)),
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          });

          // Store study info for clustering
          (studyMarker as any).studyId = studyId;
          (studyMarker as any).studyName = study.name;
          (studyMarker as any).studyColor = color;

          // Add popup with study information
          studyMarker.bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #2c3e50;">${study.name}</h3>
              <div style="margin-bottom: 8px;">
                <strong>Ecosystem:</strong> ${study.ecosystem}<br>
                <strong>Sample Count:</strong> ${study.sample_count}<br>
                <strong>Measurement Types:</strong><br>
                ${study.measurement_types.map(type => `• ${type}`).join('<br>')}
              </div>
              <div style="font-size: 0.9em; color: #666;">
                <strong>Omics Coverage:</strong><br>
                • Metagenomics: ${study.metagenome_processed}<br>
                • Metatranscriptomics: ${study.metatranscriptome_processed}<br>
                • Proteomics: ${study.proteomics_processed}<br>
                • Metabolomics: ${study.metabolomics_processed}
              </div>
            </div>
          `);

          // Add hover tooltip
          studyMarker.bindTooltip(`${study.name} (${study.sample_count} samples)`);

          // Add study marker to cluster
          markerCluster.current?.addLayer(studyMarker);
          markers.current.push(studyMarker as ExtendedMarker);

          // Add markers for each sample location
          if (study.sample_locations && study.sample_locations.length > 0) {
            study.sample_locations.forEach(location => {
              const sampleMarker = L.circleMarker([location.latitude, location.longitude], {
                radius: 3,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
              });

              // Store study info for clustering
              (sampleMarker as any).studyId = studyId;
              (sampleMarker as any).studyName = study.name;
              (sampleMarker as any).studyColor = color;

              // Add popup with sample information
              sampleMarker.bindPopup(`
                <div style="min-width: 150px;">
                  <strong>${study.name}</strong><br>
                  <small>Sample Location</small><br>
                  <small>Lat: ${location.latitude.toFixed(4)}</small><br>
                  <small>Lon: ${location.longitude.toFixed(4)}</small>
                </div>
              `);

              // Add sample marker to cluster
              markerCluster.current?.addLayer(sampleMarker);
              markers.current.push(sampleMarker as ExtendedMarker);
            });
          }
        });

        // Add cluster group to map
        if (markerCluster.current && map.current) {
          map.current.addLayer(markerCluster.current);
        }

        // Fit map to markers if we have any
        if (map.current && markers.current.length > 0) {
          const group = L.featureGroup(markers.current);
          map.current.fitBounds(group.getBounds().pad(0.005));
        }

        setLoading(false);
      }, 100);
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }

    // Cleanup function
    return () => {
      if (markerCluster.current) {
        markerCluster.current.clearLayers();
        markerCluster.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      markers.current = [];
    };
  }, [studies]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
          <CircularProgress />
        </Box>
      )}
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default StudyMap; 