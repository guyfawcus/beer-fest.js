#!/bin/bash -i

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

cd "$parent_path"/../public/downloads/

for file in *.csv
do
  if [[ "$file" =~ ^ACBF[0-9]+-[0-9]{4}\.csv$ ]]; then
    output=$(frictionless validate "$file" --schema tableschema.json 2>&1)
    status=$?
    if [ $status -eq 1 ]; then
      echo "$output"
    else
      echo "Working on $file"
    fi
  fi
done

