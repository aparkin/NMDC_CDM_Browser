import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Sample } from '../types';
import { configureLeafletIcons, defaultClusterOptions, getEcosystemColor, mapStyles } from '../utils/mapConfig';

// Extend CircleMarkerOptions to include our custom property
interface CustomCircleMarkerOptions extends L.CircleMarkerOptions {
  __targetSample?: boolean;
}

interface Location {
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
    [key: string]: any;
  }>;
}

interface MapContainerProps {
  samples?: Sample[];
  locations?: Location[];
  onSampleClick?: (sample: Sample) => void;
  selectedSampleId?: string;
  targetSampleId?: string;
  highlightSampleId?: string;
}

const MapContainer: React.FC<MapContainerProps> = ({ 
  samples,
  locations,
  onSampleClick, 
  selectedSampleId,
  targetSampleId,
  highlightSampleId
}) => {
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
    }

    // Clear existing markers
    if (markersRef.current) {
      markersRef.current.clearLayers();
    } else if (mapRef.current) {
      markersRef.current = L.markerClusterGroup({
        ...defaultClusterOptions,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 18,
        spiderLegPolylineOptions: { weight: 1.5, color: '#222', opacity: 0.5 },
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let size = 'large';
          if (count < 10) size = 'small';
          else if (count < 100) size = 'medium';
          
          // Check if this cluster contains the target sample
          const hasTargetSample = cluster.getAllChildMarkers().some((marker: any) => 
            marker.__targetSample || 
            (marker.options && marker.options.__targetSample)
          );
          
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}${hasTargetSample ? ' marker-cluster-target' : ''}`,
            iconSize: L.point(40, 40)
          });
        }
      });
      mapRef.current.addLayer(markersRef.current);
    }

    // Process samples if provided
    if (samples && markersRef.current) {
      samples.forEach(sample => {
        if (sample.latitude && sample.longitude && markersRef.current) {
          const isTargetSample = sample.id === targetSampleId || sample.id === highlightSampleId;
          const color = getEcosystemColor(sample.ecosystem_type);
          const marker = L.circleMarker([sample.latitude, sample.longitude], {
            radius: isTargetSample ? 12 : 8,
            color: color,
            weight: isTargetSample ? 3 : 2,
            opacity: 1,
            fillOpacity: 0.8,
            __targetSample: isTargetSample
          } as CustomCircleMarkerOptions);

          // Add popup with sample information
          const popupContent = `
            <div class="custom-popup">
              <h3 style="margin: 0 0 8px 0; color: #333;">${sample.name}</h3>
              <p style="margin: 0 0 4px 0; color: #666;">ID: ${sample.id}</p>
              ${sample.description ? `<p style="margin: 0 0 4px 0; color: #666;">${sample.description}</p>` : ''}
              ${sample.ecosystem ? `<p style="margin: 0 0 4px 0; color: #666;">Ecosystem: ${sample.ecosystem}</p>` : ''}
              ${sample.ecosystem_category ? `<p style="margin: 0 0 4px 0; color: #666;">Category: ${sample.ecosystem_category}</p>` : ''}
              ${sample.ecosystem_subtype ? `<p style="margin: 0 0 4px 0; color: #666;">Subtype: ${sample.ecosystem_subtype}</p>` : ''}
              ${sample.ecosystem_type ? `<p style="margin: 0 0 4px 0; color: #666;">Type: ${sample.ecosystem_type}</p>` : ''}
              ${sample.specific_ecosystem ? `<p style="margin: 0 0 4px 0; color: #666;">Specific: ${sample.specific_ecosystem}</p>` : ''}
            </div>
          `;

          marker.bindPopup(popupContent);

          // Add click handler if provided
          if (onSampleClick) {
            marker.on('click', () => onSampleClick(sample));
          }

          markersRef.current.addLayer(marker);
        }
      });
    }

    // Process locations if provided
    if (locations && markersRef.current) {
      locations.forEach(location => {
        // Create a marker for each sample at this location
        location.samples?.forEach(sample => {
          if (markersRef.current) {
            const isTargetSample = sample.id === targetSampleId || sample.id === highlightSampleId;
            const marker = L.circleMarker([location.latitude, location.longitude], {
              radius: isTargetSample ? 12 : 6,
              fillColor: isTargetSample ? '#ff0000' : getEcosystemColor(location.ecosystem_type),
              color: '#fff',
              weight: isTargetSample ? 3 : 2,
              opacity: 1,
              fillOpacity: 0.8,
              __targetSample: isTargetSample
            } as CustomCircleMarkerOptions);

            // Create popup content for this specific sample
            const popupContent = `
              <div class="custom-popup">
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

            markersRef.current.addLayer(marker);
          }
        });

        // If there are no samples at this location, create a single marker
        if (!location.samples?.length && markersRef.current) {
          const marker = L.circleMarker([location.latitude, location.longitude], {
            radius: 6,
            fillColor: getEcosystemColor(location.ecosystem_type),
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          });

          // Create popup content for the location
          const popupContent = `
            <div class="custom-popup">
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

          markersRef.current.addLayer(marker);
        }
      });
    }

    // Fit map to markers if there are any
    if (markersRef.current && markersRef.current.getLayers().length > 0 && mapRef.current) {
      mapRef.current.fitBounds(markersRef.current.getBounds(), {
        padding: [50, 50]
      });
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
  }, [samples, locations, onSampleClick, selectedSampleId, targetSampleId, highlightSampleId]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        height: '100%', 
        width: '100%',
        minHeight: '300px' // Ensure a minimum height
      }} 
    />
  );
};

export default MapContainer; 