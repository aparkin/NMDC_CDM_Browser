export interface Study {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  ecosystem?: string;
  ecosystem_type?: string;
  ecosystem_subtype?: string;
  ecosystem_category?: string;
  specific_ecosystem?: string;
  sample_count?: number;
  depth?: number;
  temperature?: number;
  ph?: number;
  salinity?: number;
}

export interface Sample {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  ecosystem?: string;
  ecosystem_type?: string;
  ecosystem_subtype?: string;
  ecosystem_category?: string;
  specific_ecosystem?: string;
  collection_date?: string;
  collection_time?: string;
  depth?: number;
  temperature?: number;
  ph?: number;
  salinity?: number;
} 