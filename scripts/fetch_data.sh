#!/bin/bash

# Run the Python script
echo "Running Python script to fetch and process data metadata"
python3 utils/fetch_and_process.py

# Check if the Python script executed successfully
if [ $? -eq 0 ]; then
  echo "Copying fast delivery station metada into the Docker container"
  docker cp /tmp/fd_metadata.geojson SEA_container:/app/data/metadata/fd_metadata.geojson
  echo "Copying altimetry data from Matthews folder to Docker container"
  docker cp /srv/htdocs/uhslc.soest.hawaii.edu/mwidlans/dev/SEA/SEAdata/cmems_altimetry_regrid.nc SEA_container:/app/data/altimetry/cmems_altimetry_regrid.nc
else
  echo "Python script failed. Skipping docker copy." >&2
fi
