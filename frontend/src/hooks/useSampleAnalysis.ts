import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface SampleAnalysis {
  id: string;
  study_id: string;
  name: string;
  collection_date?: string;
  collection_time?: string;
  ecosystem?: string;
  physical: {
    [key: string]: {
      status: 'ok' | 'no_data' | 'error';
      value?: number;
      compendium?: {
        mean: number;
        std: number;
      };
      z_score?: number;
      error?: string;
    };
  };
  omics: {
    top10: {
      metabolites: Array<{
        name: string;
        abundance: number;
      }>;
      lipids: Array<{
        name: string;
        abundance: number;
      }>;
      proteins: Array<{
        name: string;
        abundance: number;
      }>;
    };
  };
  taxonomic: {
    top10: {
      contigs: {
        [rank: string]: Array<{
          name: string;
          abundance: number;
        }>;
      };
      centrifuge: {
        [rank: string]: Array<{
          name: string;
          abundance: number;
        }>;
      };
      kraken: {
        [rank: string]: Array<{
          name: string;
          abundance: number;
        }>;
      };
      gottcha: {
        [rank: string]: Array<{
          name: string;
          abundance: number;
        }>;
      };
    };
  };
  location: {
    latitude: number;
    longitude: number;
  };
  functional_analysis: {
    [class_name: string]: {
      [label: string]: number;  // label -> relative abundance
    };
  };
  taxonomic_treemap?: {
    [source: string]: Array<{
      ids: string;
      labels: string;
      parents: string;
      values: number;
      level: number;
    }>;
  };
}

const fetchSampleAnalysis = async (sampleId: string): Promise<SampleAnalysis> => {
  const response = await axios.get(`http://localhost:8000/api/v1/sample/${sampleId}/analysis`);
  return response.data;
};

export const useSampleAnalysis = (sampleId: string | undefined) => {
  return useQuery({
    queryKey: ['sampleAnalysis', sampleId],
    queryFn: () => fetchSampleAnalysis(sampleId!),
    enabled: !!sampleId,
  });
}; 