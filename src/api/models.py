from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Union, Any
from datetime import datetime

class TimelineStudy(BaseModel):
    study_id: str = Field(..., description="Unique identifier for the study")
    start_date: datetime = Field(..., description="Start date of sample collection")
    end_date: datetime = Field(..., description="End date of sample collection")
    sample_count: int = Field(..., description="Number of samples in the study")

class TimelineSample(BaseModel):
    sample_id: str = Field(..., description="Unique identifier for the sample")
    date: datetime = Field(..., description="Collection date of the sample")
    study_id: str = Field(..., description="ID of the study this sample belongs to")

class TimelineData(BaseModel):
    sample_timeline: Dict[str, int]
    study_timeline: Dict[str, int]

class EcosystemData(BaseModel):
    variable: str
    value_counts: Dict[str, int]
    total_samples: int
    unique_values: int
    error: Optional[str] = None

class PhysicalVariableData(BaseModel):
    variable: str
    mean: float
    std: float
    min: float
    max: float
    count: int
    histogram: Dict[str, List[float]]
    error: Optional[str] = None

class OmicsData(BaseModel):
    compound_name: Optional[str] = None
    lipid_molecular_species: Optional[str] = None
    product: Optional[str] = None
    mean_abundance: float
    std_abundance: float
    additional_fields: Dict[str, Any] = {}

class TaxonomicData(BaseModel):
    rank: str
    lineage: str
    mean_abundance: float
    std_abundance: float
    mean_species_count: Optional[float] = None
    std_species_count: Optional[float] = None

class EcosystemStats(BaseModel):
    variable: str = Field(..., description="Name of the ecosystem variable")
    value_counts: Dict[str, int] = Field(..., description="Count of samples for each value")
    total_samples: int = Field(..., description="Total number of samples")
    unique_values: int = Field(..., description="Number of unique values")
    error: Optional[str] = Field(None, description="Error message if any")

class PhysicalVariableStats(BaseModel):
    variable: str = Field(..., description="Name of the physical variable")
    mean: float = Field(..., description="Mean value")
    std: float = Field(..., description="Standard deviation")
    min: float = Field(..., description="Minimum value")
    max: float = Field(..., description="Maximum value")
    count: int = Field(..., description="Number of samples")
    histogram: Dict[str, List[float]] = Field(..., description="Histogram data with values and bin edges")
    error: Optional[str] = Field(None, description="Error message if any")

class OmicsStats(BaseModel):
    compound_name: Optional[str] = Field(None, description="Name of the compound (for metabolomics)")
    lipid_molecular_species: Optional[str] = Field(None, description="Lipid molecular species (for lipidomics)")
    product: Optional[str] = Field(None, description="Product name (for proteomics)")
    mean_abundance: float = Field(..., description="Mean abundance value")
    std_abundance: float = Field(..., description="Standard deviation of abundance")
    common_name: Optional[str] = Field(None, description="Common name (for metabolomics)")
    molecular_formula: Optional[str] = Field(None, description="Molecular formula (for metabolomics)")
    lipid_class: Optional[str] = Field(None, description="Lipid class (for lipidomics)")
    lipid_category: Optional[str] = Field(None, description="Lipid category (for lipidomics)")
    gene_count: Optional[int] = Field(None, description="Gene count (for proteomics)")
    unique_peptide_count: Optional[int] = Field(None, description="Unique peptide count (for proteomics)")
    ec_number: Optional[str] = Field(None, description="EC number (for proteomics)")
    pfam: Optional[str] = Field(None, description="Pfam identifier (for proteomics)")
    ko: Optional[str] = Field(None, description="KO identifier (for proteomics)")
    cog: Optional[str] = Field(None, description="COG identifier (for proteomics)")

class TaxonomicStats(BaseModel):
    rank: str = Field(..., description="Taxonomic rank")
    lineage: Optional[str] = Field(None, description="Taxonomic lineage")
    label: Optional[str] = Field(None, description="Taxonomic label (for GOTTCHA)")
    mean_abundance: float = Field(..., description="Mean abundance")
    std_abundance: float = Field(..., description="Standard deviation of abundance")
    mean_species_count: Optional[float] = Field(None, description="Mean species count")
    std_species_count: Optional[float] = Field(None, description="Standard deviation of species count")
    mean_read_count: Optional[float] = Field(None, description="Mean read count")
    std_read_count: Optional[float] = Field(None, description="Standard deviation of read count")

class StudyCard(BaseModel):
    id: str = Field(..., description="Unique identifier for the study")
    name: str = Field(..., description="Name of the study")
    description: str = Field(..., description="Description of the study")
    sample_count: int = Field(..., description="Number of samples in the study")
    measurement_types: List[str] = Field(..., description="Types of measurements available")
    primary_ecosystem: str = Field(..., description="Primary ecosystem of the study")
    add_date: Optional[datetime] = Field(None, description="Date when the study was added")
    ecosystem: Optional[str] = Field(None, description="Ecosystem classification")
    ecosystem_category: Optional[str] = Field(None, description="Ecosystem category")
    ecosystem_subtype: Optional[str] = Field(None, description="Ecosystem subtype")
    ecosystem_type: Optional[str] = Field(None, description="Ecosystem type")
    latitude: Optional[float] = Field(None, description="Latitude of the study location")
    longitude: Optional[float] = Field(None, description="Longitude of the study location")
    sample_locations: Optional[List[Dict[str, Union[float, str, int]]]] = Field(None, description="Sample locations with coordinates")

class StudySummary(BaseModel):
    total_studies: int = Field(..., description="Total number of studies")
    total_samples: int = Field(..., description="Total number of samples")
    date_range: Dict[str, Optional[datetime]] = Field(..., description="Date range of studies")
    ecosystem_distribution: Dict[str, int] = Field(..., description="Distribution of ecosystems")
    measurement_coverage: Dict[str, List[str]] = Field(..., description="Measurement coverage by study")
    time_series: Optional[Dict[str, List[Union[str, int]]]] = Field(None, description="Time series data")
    measurement_distribution: Dict[str, Dict[str, Union[int, float]]] = Field(..., description="Distribution of measurement types")
    ecosystem_type_distribution: Dict[str, Dict[str, int]] = Field(..., description="Distribution of ecosystem types")
    sample_count_stats: Dict[str, Union[float, int]] = Field(..., description="Sample count statistics") 