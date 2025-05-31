import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { MapContainer as LeafletMap, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/images/marker-icon-2x.png',
  iconUrl: '/images/marker-icon.png',
  shadowUrl: '/images/marker-shadow.png',
});

// Extend CircleMarkerOptions to include sampleCount
declare module 'leaflet' {
  interface CircleMarkerOptions {
    sampleCount?: number;
    sampleId?: string;
    locationKey?: string;
  }
}

export interface Location {
  latitude: number;
  longitude: number;
  sample_count: number;
  ecosystem?: string;
  ecosystem_type?: string;
  ecosystem_subtype?: string;
  specific_ecosystem?: string;
  samples?: Array<{
    id: string;
    sample_name: string;
    collection_date: string;
    collection_time: string;
    ecosystem: string;
    ecosystem_type: string;
    ecosystem_subtype: string;
    specific_ecosystem: string;
    depth?: number;
    temperature?: number;
    ph?: number;
    salinity?: number;
    [key: string]: any; // Allow for additional sample properties
  }>;
}

interface MapContainerProps {
  locations: Location[];
  center?: [number, number];
  initialZoom?: number;
  highlightSampleId?: string;
}

// Generate consistent colors based on ecosystem type
const getEcosystemColor = (ecosystemType: string | null | undefined) => {
  const colors = {
    'soil': '#8B4513',
    'water': '#1E90FF',
    'air': '#87CEEB',
    'host': '#FF69B4',
    'wastewater': '#808080',
    'sediment': '#A0522D',
    'biofilm': '#32CD32',
    'default': '#1976d2'
  };
  
  if (!ecosystemType) return colors.default;
  
  const type = ecosystemType.toLowerCase();
  for (const [key, color] of Object.entries(colors)) {
    if (type.includes(key)) return color;
  }
  
  return colors.default;
};

export const MapContainer: React.FC<MapContainerProps> = ({ 
  locations, 
  center,
  initialZoom = 2,
  highlightSampleId
}) => {
  const defaultCenter: [number, number] = center || [0, 0];
  const mapRef = useRef<L.Map | null>(null);
  const markerClusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
    }

    // Create marker cluster group with improved settings
    const markerCluster = L.markerClusterGroup({
      maxClusterRadius: 80,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 15,
      spiderLegPolylineOptions: { weight: 1.5, color: '#1976d2', opacity: 0.5 },
      // Custom cluster icon with dynamic size and highlighting
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const markers = cluster.getAllChildMarkers();
        const totalSamples = markers.reduce((sum, marker) => {
          if (marker instanceof L.CircleMarker) {
            return sum + (marker.options.sampleCount || 1);
          }
          return sum;
        }, 0);
        
        // Check if this cluster contains the target sample
        const containsTargetSample = markers.some(marker => {
          if (!(marker instanceof L.CircleMarker)) return false;
          const markerLocation = locations.find(loc => 
            loc.latitude === marker.getLatLng().lat && 
            loc.longitude === marker.getLatLng().lng
          );
          return markerLocation?.samples?.some(sample => sample.id === highlightSampleId);
        });
        
        // Calculate size based on sample count
        const size = Math.min(60, Math.max(40, 30 + Math.log2(totalSamples) * 5));
        
        return L.divIcon({
          html: `<div style="background-color: ${containsTargetSample ? '#ff4444' : '#1976d2'}; color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            <span style="font-weight: bold; font-size: ${Math.min(16, Math.max(12, 12 + Math.log2(totalSamples)))}px;">${totalSamples}</span>
            <small style="font-size: ${Math.min(10, Math.max(8, 8 + Math.log2(totalSamples)))}px;">samples</small>
          </div>`,
          className: containsTargetSample ? 'marker-cluster target-cluster' : 'marker-cluster',
          iconSize: L.point(size, size)
        });
      }
    });

    // Add markers to cluster
    locations.forEach((location) => {
      // Create a marker for each sample at this location
      location.samples?.forEach(sample => {
        const isTargetSample = sample.id === highlightSampleId;
        const marker = L.circleMarker([location.latitude, location.longitude], {
          radius: isTargetSample ? 10 : 6,
          fillColor: isTargetSample ? '#ff0000' : getEcosystemColor(location.ecosystem_type),
          color: '#fff',
          weight: isTargetSample ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.8,
          sampleCount: 1, // Each marker represents one sample
          sampleId: sample.id // Store the sample ID
        });

        // Create popup content for this specific sample
        const popupContent = `
          <div style="min-width: 200px; padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">
              ${sample.sample_name || 'Unnamed Sample'}
            </div>
            <div style="font-size: 12px; color: #666;">
              <div><strong>ID:</strong> ${sample.id || 'Unknown'}</div>
              <div><strong>Collection Date:</strong> ${sample.collection_date || 'N/A'}</div>
              <div><strong>Coordinates:</strong> ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</div>
              <div><strong>Ecosystem:</strong> ${sample.ecosystem || 'N/A'}</div>
              <div><strong>Ecosystem Category:</strong> ${sample.ecosystem_category || 'N/A'}</div>
              <div><strong>Ecosystem Subtype:</strong> ${sample.ecosystem_subtype || 'N/A'}</div>
              <div><strong>Ecosystem Type:</strong> ${sample.ecosystem_type || 'N/A'}</div>
              <div><strong>Specific Ecosystem:</strong> ${sample.specific_ecosystem || 'N/A'}</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add hover tooltip
        marker.bindTooltip(sample.sample_name || 'Unnamed Sample', {
          permanent: false,
          direction: 'top',
          className: 'custom-tooltip'
        });

        // Add a unique key to the marker for React
        (marker as any).key = `${location.latitude},${location.longitude}-${sample.id}`;

        markerCluster.addLayer(marker);
      });

      // If there are no samples at this location, create a single marker
      if (!location.samples?.length) {
        const marker = L.circleMarker([location.latitude, location.longitude], {
          radius: 6,
          fillColor: getEcosystemColor(location.ecosystem_type),
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          sampleCount: location.sample_count
        });

        // Create popup content for the location
        const popupContent = `
          <div style="min-width: 200px; padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">
              Location
            </div>
            <div style="font-size: 12px; color: #666;">
              <div><strong>Coordinates:</strong> ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</div>
              <div><strong>Samples:</strong> ${location.sample_count}</div>
              ${location.ecosystem ? `<div><strong>Ecosystem:</strong> ${location.ecosystem}</div>` : ''}
              ${location.ecosystem_type ? `<div><strong>Type:</strong> ${location.ecosystem_type}</div>` : ''}
              ${location.ecosystem_subtype ? `<div><strong>Subtype:</strong> ${location.ecosystem_subtype}</div>` : ''}
              ${location.specific_ecosystem ? `<div><strong>Specific:</strong> ${location.specific_ecosystem}</div>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add hover tooltip
        marker.bindTooltip(`${location.sample_count} samples`, {
          permanent: false,
          direction: 'top',
          className: 'custom-tooltip'
        });

        // Add a unique key to the marker for React
        (marker as any).key = `${location.latitude},${location.longitude}-location`;

        markerCluster.addLayer(marker);
      }
    });

    // Add cluster group to map
    mapRef.current.addLayer(markerCluster);
    markerClusterRef.current = markerCluster;

    // Fit map to markers if we have any
    if (locations.length > 0) {
      const group = L.featureGroup(markerCluster.getLayers());
      const bounds = group.getBounds().pad(0.1);
      mapRef.current.fitBounds(bounds);
    }

    // Add custom CSS for tooltips, popups, and cluster animations
    const style = document.createElement('style');
    style.textContent = `
      .custom-tooltip {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        white-space: nowrap;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .leaflet-popup-content {
        margin: 0;
        max-height: 300px;
        overflow-y: auto;
      }
      .leaflet-popup-content::-webkit-scrollbar {
        width: 8px;
      }
      .leaflet-popup-content::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      .leaflet-popup-content::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
      }
      .leaflet-popup-content::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      .marker-cluster {
        background: none !important;
      }
      .marker-cluster div {
        background-color: #1976d2 !important;
      }
      .target-cluster div {
        background-color: #ff4444 !important;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(255, 68, 68, 0);
        }
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      if (markerClusterRef.current) {
        markerClusterRef.current.clearLayers();
        markerClusterRef.current = null;
      }
      document.head.removeChild(style);
    };
  }, [locations, highlightSampleId]);

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <LeafletMap
        center={defaultCenter}
        zoom={initialZoom}
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