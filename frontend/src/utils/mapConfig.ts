import L from 'leaflet';

// Configure default marker icons
export const configureLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/marker-icon-2x.png',
    iconUrl: '/images/marker-icon.png',
    shadowUrl: '/images/marker-shadow.png',
  });
};

// Common marker cluster options
export const defaultClusterOptions: L.MarkerClusterGroupOptions = {
  maxClusterRadius: 80,
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
    const hasTargetSample = (cluster as any).__targetSample;
    
    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `marker-cluster marker-cluster-${size}${hasTargetSample ? ' marker-cluster-target' : ''}`,
      iconSize: L.point(40, 40)
    });
  }
};

// Common marker styles
export const markerStyles = {
  default: {
    radius: 6,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  },
  highlighted: {
    radius: 10,
    color: '#fff',
    weight: 3,
    opacity: 1,
    fillOpacity: 0.8,
  },
};

// Ecosystem color mapping
export const getEcosystemColor = (ecosystemType: string | null | undefined) => {
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

// Study color mapping
export const getStudyColor = (studyId: string) => {
  const colors = [
    '#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9',
    '#bbdefb', '#e3f2fd', '#1565c0', '#0d47a1', '#1e88e5'
  ];
  const hash = studyId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Common map styles
export const mapStyles = `
  .marker-cluster {
    background-clip: padding-box;
    border-radius: 20px;
  }
  .marker-cluster div {
    width: 30px;
    height: 30px;
    margin-left: 5px;
    margin-top: 5px;
    text-align: center;
    border-radius: 15px;
    font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .marker-cluster span {
    color: #fff;
    font-weight: bold;
  }
  .marker-cluster-small {
    background-color: rgba(181, 226, 140, 0.8);
  }
  .marker-cluster-small div {
    background-color: rgba(110, 204, 57, 0.8);
  }
  .marker-cluster-medium {
    background-color: rgba(241, 211, 87, 0.8);
  }
  .marker-cluster-medium div {
    background-color: rgba(240, 194, 12, 0.8);
  }
  .marker-cluster-large {
    background-color: rgba(253, 156, 115, 0.8);
  }
  .marker-cluster-large div {
    background-color: rgba(241, 128, 23, 0.8);
  }
  .marker-cluster-huge {
    background-color: rgba(241, 128, 23, 0.8);
  }
  .marker-cluster-huge div {
    background-color: rgba(241, 128, 23, 0.8);
  }
  .marker-cluster-giant {
    background-color: rgba(241, 128, 23, 0.8);
  }
  .marker-cluster-giant div {
    background-color: rgba(241, 128, 23, 0.8);
  }
  .marker-cluster-target {
    background-color: rgba(255, 82, 82, 0.9) !important;
    box-shadow: 0 0 0 4px rgba(255, 82, 82, 0.3);
  }
  .marker-cluster-target div {
    background-color: rgba(244, 67, 54, 0.9) !important;
    animation: target-pulse 2s infinite;
  }
  .marker-cluster-animate {
    animation: marker-cluster-animation 0.3s ease-in-out;
  }
  @keyframes marker-cluster-animation {
    0% { transform: scale(0.8); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .marker-cluster-spider {
    animation: marker-cluster-spider 0.3s ease-in-out;
  }
  @keyframes marker-cluster-spider {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes target-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
    50% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
  }
  .custom-tooltip {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .custom-popup {
    font-family: Arial, sans-serif;
  }
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .custom-popup .leaflet-popup-content {
    margin: 12px;
    line-height: 1.4;
  }
  .custom-popup .leaflet-popup-tip {
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
`; 