#!/bin/sh
source .env
scp $1 "$BF2_SERVER_USER"@"$BF2_SERVER_IP":$2