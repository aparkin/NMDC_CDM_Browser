import requests
import json
from pprint import pprint
from typing import Optional, Dict, Any
import argparse

BASE_URL = "http://localhost:8000/api/statistics"

def test_endpoint(endpoint: str, params: Optional[Dict[str, Any]] = None) -> None:
    """Test an endpoint and print the results"""
    url = f"{BASE_URL}/{endpoint}"
    print(f"\nTesting {url}")
    print("-" * 80)
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        print(f"Status: {response.status_code}")
        print("Response:")
        pprint(data)
    except requests.exceptions.RequestException as e:
        print(f"Error: {str(e)}")
    print("-" * 80)

def main():
    parser = argparse.ArgumentParser(description='Test statistics API endpoints')
    parser.add_argument('--endpoint', help='Specific endpoint to test (e.g., taxonomic/gottcha)')
    args = parser.parse_args()

    if args.endpoint:
        test_endpoint(args.endpoint)
    else:
        # Test timeline data
        test_endpoint("timeline")
        
        # Test ecosystem statistics
        test_endpoint("ecosystem/ecosystem")
        test_endpoint("ecosystem/ecosystem_category")
        
        # Test physical variable statistics
        test_endpoint("physical/avg_temp")
        test_endpoint("physical/ph")
        
        # Test omics statistics
        test_endpoint("omics/metabolomics")
        test_endpoint("omics/lipidomics")
        test_endpoint("omics/proteomics")
        
        # Test taxonomic statistics
        test_endpoint("taxonomic/contigs")
        test_endpoint("taxonomic/centrifuge")
        test_endpoint("taxonomic/kraken")
        test_endpoint("taxonomic/gottcha")

if __name__ == "__main__":
    main() 