#!/usr/bin/env bash

~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -kill
cd /home/bf2
screen -AdmS bf2server bash -c "~bf2/mono-1.1.12.1/bin/mono ~bf2/server/bf2ccd.exe -showlog -autostart BF2_Playerbase_XX"
