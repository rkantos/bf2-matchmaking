#!/usr/bin/env bash

bf2dir=$(eval echo ~$BF2SERVERUSER)
path_server="/server/"

if [ "$2" == "vehicles" ]; then
	vehicles="BF2_Playerbase_8v8_vehicles"
	file=$bf2dir$path_server$vehicles.profile
elif [ "$2" == "bf2top" ]; then
	bf2top="bf2top"
	file=$bf2dir$path_server$bf2top.profile
else
	inf="BF2_Playerbase_XX"
	file=$bf2dir$path_server$inf.profile
fi

restart () {
	cd /home/bf2
	~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -kill

	if [ "$vehicles" ]; then
		screen -AdmS bf2server bash -c "~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -showlog -autostart $vehicles"
	elif [ "$bf2top" ]; then
		screen -AdmS bf2server bash -c "~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -showlog -autostart $bf2top"
	else
		screen -AdmS bf2server bash -c "~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -showlog -autostart $inf"
	fi
}

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 file.xml map_name"
#    exit 1
fi

file=$file
map_name="$1"

# Make a backup of the original file
cp "$file" "$file.bak"

#echo "file" $2 $file
#echo "map_name" $1 $1

# Find the map with the name provided as argument
map_index=$(xmlstarlet sel -t -v "count(//RunningMaps[MapName='$map_name'])" $file)
if [ "$map_index" -eq "0" ]; then
	echo "Error: Map name not found in file"
	# Change ServerName
	xmlstarlet ed -L -u "//GameInfo/ServerName" -v "$3" $file
	restart
	exit 0
else
	# Change ServerName
	xmlstarlet ed -L -u "//GameInfo/ServerName" -v "$3" $file

	# Change the order of the map with the name provided as argument to 0
	xmlstarlet ed -L -u "//RunningMaps[MapName='$map_name']/Order" -v "0" $file
	xmlstarlet ed -L -u "//RunningMaps[MapName='$map_name']/RunningMapID" -v "0" $file

	# Reorder the remaining maps
	for i in $(seq 1 $(xmlstarlet sel -t -v "count(//RunningMaps[MapName])" $file)); do
	xmlstarlet ed -L -u "//RunningMaps[MapName!='$map_name'][$i]/Order" -v "$((i))" $file
	xmlstarlet ed -L -u "//RunningMaps[MapName!='$map_name'][$i]/RunningMapID" -v "$((i))" $file
	done

	# Reformat the XML file to preserve the original formatting
	xmlstarlet fo "$file" > "$file.tmp"
	mv "$file.tmp" "$file"
	restart
	exit 0
fi
