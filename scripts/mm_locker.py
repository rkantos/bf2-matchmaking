# vim: ts=4 sw=4 noexpandtab
"""Locker BF2 ModManager Module

Requirements:
If using the lockfile(s):
- Needs lockfile_monitor.sh running like:
screen -AdmS locker bash -c "~bf2/lockfiles_monitor.sh"
- visudo / /etc/sudoers
else:
- nothing



This is a slot paswordless mix server script (mm_locker) based on reserver ModManager module.

It works by kicking people when the set amount of players has been reached. It determines the maximum amount of players based on the server name.
1v1 = 2, 4v4 = 8, 8v8 = 16 etc - see self.server_capacity. You can optionally also make this script create a lockfile which you can then monitor externally to change firewall settings for example. For BF2 it works very nicely with Debian and firewalld (nftables) when you just block UDP/16567 when everyone is on the server. Existing "connections" to the 16567 will remain, but new ones will be blocked. To then unlock the server the "firewall-cmd --reload" command can be run.

Additionally this script monitors connected players and makes a log of them in "csv":
"date time","cdkeyhash","playerid","tag+nick","jointime","1th,2nd,3rd... join","0/kicked"

The old detail from the reserver ModManager module is still relevant because DICE could apparently never make the +password option to join password protected servers to work:
This is by no means optimium but without the ability to password the server on the fly or to know when a "registered" player is attempting to join there are no other ways.


===== Config ===== TODO
 # The number of slots to reserver
 mm_reserver.reservedSlots 1
 
 # The delay after messaging the player before they are kicked
 mm_reserver.kickDelay 5
 
 # The kick mode used:
 # 1: On spawn ( default: tells the player why they are being kicked )
 # 2: On connect ( kicks as soon as the player attempts to connect )
 mm_reserver.kickMode 2
 
 # The kick type used:
 # 1: rcon
 mm_reserver.kickType 1
 
 # The message used
 mm_reserver.kickReason "Reserved slots reached"
 
 # The private password to be used on the server when reserved slots are required
 mm_reserver.privatePassword ""

 # Add profileids to the reserved list
 mm_reserver.addProfileId 11111
 mm_reserver.addProfileId 22222

===== Notes =====


===== History =====
 v0.5 - 19/02/2023:
 v0.4 - 19/02/2023:
 - add sv.numPlayersNeededToStart %s"%max_players in init and when mix starts "sv.numPlayersNeededToStart 0"
 - rename lockServer, unlockServer to ManualLock and ManualUnlock respectively
 - add kicking players as the default server locking method. lockfiles and external monitor is not needed with this method
 - lockfile can still be used if needed in the future
 - add player join time logging
 - add onGameStatusChanged() to set sv.startDelay 30 again (once)
 v0.3 - 15/02/2023:
 - self.LockServer()
 - self.Log()
 - todo: check that line 322 ServerMessage is displayed when there is a player on the server, kick command
 v0.2 - 15/02/2023:
 - LogPlayerConnectMessage(): self.player_reconnect_dict to track player reconnections for self.filename_player_jointimes
 - host.rcon_invoke("sv.spawnTime 0")
 - host.rcon_invoke("sv.manDownTime 0")
 - host.rcon_invoke("sv.startDelay 0")
 - lockServer, unlockServer
 - rcon lock, unlock, fastkick command
 - todo, fix fastkick command since it just kicks id 0 when there are no arguments
 v0.1 - 14/02/2023:
 Initial version - added a lot of shit


"""

import bf2
import host
import mm_utils
import os
import sys
import time
from socket import gethostname, getfqdn

__version__ = 0.5

__required_modules__ = {
	'modmanager': 1.6
}

__supports_reload__ = True

__supported_games__ = {
	'bf2': True,
	'bf2142': True,
	'bfheroes': False,
	'bfp4f': False
}

__description__ = "ModManager Locker v%s" % __version__

class KickMode:
	onSpawn = 1
	onConnect = 2

# Add all your configuration options here
configDefaults = {
	'reservedSlots': 1,
	'privatePassword': '',
	'kickDelay': 5,
	'kickMode': KickMode.onConnect,
	'kickType': mm_utils.KickBanType.rcon,
	'profileIds': [],
	'kickReason': "Reserved slots reached"
}

class Locker( object ):

	def __init__( self, modManager ):
		# ModManager reference
		self.mm = modManager

		# Internal shutdown state
		self.__state = 0

		# Your rcon commands go here:
		self.__cmds = {
			'unlock': { 'method': self.ManualUnlock, 'level': 0 },
			'lock': { 'method': self.ManualLock, 'level': 0 },
			# '!kick': { 'method': self.kickNoAuth, 'args': '<profileid>', 'level': 0 },
			# '!restart': { 'method': self.restartRound,  'level': 0 },
		}
		self.lockfilename = "bf2_firewall.lockfile"
		self.lockfilename_stream = "bf2_stream.lockfile"
		# self.server_name = host.rcon_invoke("sv.serverName")
		# print(gethostname())

		self.filename_player_jointimes = gethostname() + "_player_jointimes.txt"
		self.Log("player_jointimes file: server/" + self.filename_player_jointimes, "info")
		# self.startTimeUTC = int( time.time() )
		self.server_capacity = {
			"0v0": 1,
			"1v1": 2,
			"2v2": 4,
			"4v4": 8,
			"5v5": 10,
			"8v8": 16
		}
		self.valid_server_names = self.server_capacity.keys()
		self.streamer_prefix = 'STREAM'
		
		host.rcon_invoke("sv.spawnTime 0")
		host.rcon_invoke("sv.manDownTime 0")
		host.rcon_invoke("sv.startDelay 60")
		
		self.game_started_once = False

		# Log = "Start onPlayerConnect";mm_utils.msg_server( Log );self.mm.info( Log )
		try:
			self.server_name = host.rcon_invoke("sv.serverName")
		except:
			self.mm.error("Failed to check player name", True)
		for valid_server_name in self.valid_server_names:
			if valid_server_name in self.server_name:
				max_players = self.server_capacity[valid_server_name]
				host.rcon_invoke( "sv.numPlayersNeededToStart %s"%max_players )
				
		self.server_start_time = int(time.time())
		self.player_connected_logged_once = []
		self.player_reconnect_dict = {}

	def cmdExec( self, ctx, cmd ):
		"""Execute a Locker sub command."""

		# Note: The Python doc above is used for help / description
		# messages in rcon if not overriden
		return mm_utils.exec_subcmd( self.mm, self.__cmds, ctx, cmd )
		
	def onGameStatusChanged( self, status ):
		if self.game_started_once == True and bf2.GameStatus.Playing == status:
			host.unregisterGameStatusHandler( self.onGameStatusChanged )
			host.rcon_invoke("sv.startDelay 30")
			Log("onGameStatusChanged", "info")
		else:
			self.game_started_once = True

	def onPlayerConnect( self, player ):
		# Log = "Start onPlayerConnect";mm_utils.msg_server( Log );self.mm.info( Log )
		try:
			player_name = player.getName()
			player_ip = player.getAddress()
			self.server_name = host.rcon_invoke("sv.serverName")
		except:
			self.mm.error("Failed to check player name", True)
		if player_name.startswith(self.streamer_prefix):
			try:
				self.LogPlayerConnectMessage( player )
				f = open(self.lockfilename_stream, "a+")
				f.write(player_ip + '\n')
				f.close()
			except Exception, e:
				mm_utils.msg_server( str(e) )
			self.mm.info( "Added streamer to the bf2.stream.lockfile" )
		else:
			# Log = "After else onPlayerConnect";mm_utils.msg_server( Log );self.mm.info( Log )
			# self.LogPlayerConnectMessage( player )
			for valid_server_name in self.valid_server_names:
				if valid_server_name in self.server_name:
					# playerCount = int(len(bf2.playerManager.getPlayers()))
	#				test4 = "test4 " + str(playerCount) + self.server_capacity[valid_server_name]
					max_players = self.server_capacity[valid_server_name]
					playerCount = 0
					kick = False
					players = bf2.playerManager.getPlayers()
					for i in range(len(bf2.playerManager.getPlayers())):
						if not bf2.playerManager.getPlayers()[i].getName().startswith(self.streamer_prefix):
							playerCount += 1
					if playerCount == max_players:
						self.LockServer( True, False, True )
						host.rcon_invoke("sv.spawnTime 15")
						host.rcon_invoke("sv.manDownTime 15")
						host.rcon_invoke("sv.startDelay 60")
						host.rcon_invoke("sv.numPlayersNeededToStart 1")
					elif playerCount > max_players:
						try:
							# Firewall lock optional
							# self.LockServer( True, False )
							# self.mm.banManager().kickPlayer( player, "server full", 5, mm_utils.KickBanType.rcon )
							self.mm.banManager().kickPlayerNow( player, mm_utils.KickBanType.rcon )
							kick = True
						except Exception, e:
							mm_utils.msg_server( str(e) )
						host.rcon_invoke("sv.spawnTime 15")
						host.rcon_invoke("sv.manDownTime 15")
						host.rcon_invoke("sv.startDelay 30")
			self.LogPlayerConnectMessage( player, kick )



		"""Kick the player if required."""
		if 1 != self.__state:
			return 0

		# Need to check due to changes
		if self.__config['kickMode'] == KickMode.onConnect:
			self.__checkPlayer( player )

		# Flag that this player has just connected
		player.mmSpawned = False

		return self.__updateServerPassword()

	def onPlayerDisconnect( self, player ):
		# self.mm.info("onPlayerDisconnect 1")
		# self.Log("onPlayerDisconnect 1", "info" )
		try:
			self.Log("Logging ok", "info" )
		except Exception, e:
			self.mm.error(str(e))
		# self.Log("onPlayerDisconnect 0", "info" )
		
		try:
			player_name = player.getName()
			player_ip = player.getAddress()
			self.server_name = host.rcon_invoke("sv.serverName")
		except Exception, e:
			self.mm.info(str(e))
			
		if not self.player_reconnect_dict[player_name]['kick']:
			e = str("onPlayerDisconnect") + str(player_name);self.Log(e, "info")
			#e = str("onPlayerDisconnect") + str(self.player_reconnect_dict);self.Log(e, "info")
		else:
			e = str("onPlayerDisconnect") + str(player_name);self.Log(e, "serverinfo")
			#e = str("onPlayerDisconnect") + str(self.player_reconnect_dict);self.Log(e, "serverinfo")
 
		try:
			player_name = player.getName()
			player_ip = player.getAddress()
			# Store player last disconnect time in a dictionary
			#e = str(player_name) + str(self.player_reconnect_dict[player_name]);self.Log(e, "info")
			self.player_reconnect_dict[player_name]['disconnect_time'] = time.time()
		except Exception, e:
			self.mm.error("Failed to check player name", True)
			self.Log(e, "error")
			# pass
		# self.Log("before if", "info" )
		if player.getName().startswith(self.streamer_prefix):
			try:
				f = open(self.lockfilename_stream, "w")
				f.write("")
				f.close()
			except Exception, e:
				self.Log(e, "error")
		else:
			try:
				for valid_server_name in self.valid_server_names:
					if valid_server_name in self.server_name:
						# self.Log(self.server_name + "if valid_server_name in self.server_name", "info")
						playerCount = 0
						e = "bf2.playerManager.getPlayers(): " + str(len(bf2.playerManager.getPlayers())) ;self.Log(e,"info")
						for i in range(len(bf2.playerManager.getPlayers())):
							if not bf2.playerManager.getPlayers()[i].getName().startswith(self.streamer_prefix):
								playerCount += 1
						e = self.server_name +" playerCount: "+ str(playerCount);self.Log(e, "info")

						if playerCount == self.server_capacity[valid_server_name]:
							try:
								self.LockServer( False, False )
							except Exception, e:
								self.Log(e, "error")
			except Exception, e:
				self.Log(e, "error")

		"""Remove player from reserved list."""
		if 1 != self.__state:
			return 0

		if self.__reservedPlayers.has_key( player.index ):
			del self.__reservedPlayers[player.index]

		return self.__updateServerPassword()
		
	def LogPlayerConnectMessage( self, player, kick ):
		# Log = "LogPlayerConnectMessage";mm_utils.msg_server( Log );self.mm.info( Log )
		try:
			self.server_name = host.rcon_invoke("sv.serverName")
			player_name = player.getName()
			player_ip = player.getAddress()
			join_time = time.time()
			if player_name not in self.player_reconnect_dict:
				join_time_delta = join_time - self.server_start_time
				# self.player_reconnect_dict[player_name] = {}
			elif player_name in self.player_reconnect_dict:
				join_time_delta = join_time - self.player_reconnect_dict[player_name]['disconnect_time']
				self.player_reconnect_dict[player_name]['reconnections'] += 1
			
			log_date_time = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(join_time))
			join_time = time.strftime("%M minutes %S seconds", time.gmtime(join_time_delta))
			if not kick:
				connect_message = player_name + " joined " + self.server_name + "in " + join_time;self.Log(connect_message, "info")
			else:
				pass
			
		except Exception, e:
			Log = e;mm_utils.msg_server( Log );self.mm.info( Log )
			self.mm.error("Failed onConnectMessage", True)
		
		# Log = "LogPlayerConnectMessage 2";mm_utils.msg_server( Log );self.mm.info( Log )
		cdkeyhash = str(mm_utils.get_cd_key_hash( player ))
		profileid = str( player.getProfileId() )		
		try:
			if len(profileid) > 1:
				playerid_cdkeyhash = cdkeyhash + ","+ profileid
		except:
			Log("no playerid for: " + player_name, "info")
			playerid_cdkeyhash = cdkeyhash + ",unknown"
		try:
			if len(cdkeyhash) > 1:
				playerid_cdkeyhash = cdkeyhash +","+ profileid
		except:
			playerid_cdkeyhash = "unknown,unknown" 
			Log("no cdkey for: " + player_name, "info")
		try:
			if player_name not in self.player_reconnect_dict:
				f = open(self.filename_player_jointimes, "a")				
				self.player_reconnect_dict[player_name] = {"disconnect_time": False, "reconnections": 0, "kick": kick}
				if not kick:
					# 2023-02-18 02:48:03,1.1.1.1,^^ rkantos[FIN],6,0,0
					line = log_date_time +","+ playerid_cdkeyhash +","+ player_name +","+ str(int(join_time_delta)) +","+ "0,0" + "\n"
					Log = "LogPlayerConnectMessage" + str(self.player_reconnect_dict[player_name]);self.Log(Log, "info")
				else:
					# 2023-02-18 02:48:03,1.1.1.1,^^ rkantos[FIN],6,0,kicked
					line = log_date_time +","+ playerid_cdkeyhash +","+ player_name +","+ str(int(join_time_delta)) +","+ "0,kicked" + "\n"
					pass
				f.write(line)
				f.close()
			else:
				f = open(self.filename_player_jointimes, "a")
				if not kick:
					# 2023-02-18 02:48:03,1.1.1.1,^^ rkantos[FIN],6,1,0
					line = log_date_time +","+ playerid_cdkeyhash +","+ player_name +","+ str(int(join_time_delta)) +","+ str(self.player_reconnect_dict[player_name]['reconnections']) +","+ "0" + "\n"
					pass
					# Log = "LogPlayerConnectMessage else" + str(self.player_reconnect_dict);self.Log(Log, "info")
				else:
					# 2023-02-18 02:48:03,1.1.1.1,^^ rkantos[FIN],6,1,kicked
					line = log_date_time +","+ playerid_cdkeyhash +","+ player_name +","+ str(int(join_time_delta)) +","+ str(self.player_reconnect_dict[player_name]['reconnections']) +","+ "kicked" + "\n"
					pass
				f.write(line)
				f.close()
		except Exception, e:
			Log = e;mm_utils.msg_server( Log );self.mm.info( Log )
			self.mm.error("Failed onConnectMessage jointimes filewrite", True)
	
	def LockServer( self, lock, no_msg, msg_only=False ):
		if lock:
			msg = "---------------Server full --- Locked the server"
		elif lock is False:
			msg = "---------------Server not full --- Unlocked the server" 
		
		if not msg_only:
			try:
				f = open(self.lockfilename, "w+")
				if lock:
					f.write("lock")
				elif lock is False:
					f.write("unlock")
				f.close()
			except Exception, e:
				self.Log(e, "error")
				
		if not no_msg:
			self.Log(msg, "info")


	def Log( self, e, error_level ):
		try:
			e = str(e)
		except Exception, e:
			self.mm.error(str("error with error format") + str(e))
			# self.mm.error(str(e))

		if error_level == "info":
			mm_utils.msg_server( e )
			self.mm.info( e )
		elif error_level == "serverinfo":
			self.mm.info( e )
		else:
			self.mm.error( e )

			
	def ManualUnlock( self, ctx, cmd):
		"""unlocks the server firewall."""
		try:
			self.LockServer( False, True )
		except Exception, e:
			mm_utils.msg_server( str(e) )
		e = "----------------Manually unlocked the server";self.Log(e, "info")

	def ManualLock( self, ctx, cmd ):
		"""Locks the server firewall."""
		try:
			self.LockServer( True, True )
		except Exception, e:
			mm_utils.msg_server( str(e) )
		e = "----------------Manually locked the server";self.Log(e, "info")
	
	def kickPlayer( self, ctx, cmd, wild=False ):
			"""Kick a player from the server with a message."""
			self.mm.debug( 2, "kickPlayer '%s' by %s" % ( cmd, ctx.getName() ) )

			( playerid, reason ) = mm_utils.largs( cmd, None, 2, '' )
			
			e = str(playerid + reason);self.Log(e, "info")

			ctx.write( 'Player %s kicked\n' % playerid )
			ctx.write( 'Reason %s kicked\n' % reason )
			ctx.write( 'CMD %s kicked\n' % cmd )
			
			player = mm_utils.find_player( playerid, wild )

			if player is None:
					ctx.write( 'Error: player %s not found\n' % playerid )
					self.mm.error( "Failed to find player %s" % playerid )
			else:
					if reason is not None:
							reason = reason.strip( '" ' )
					# self.mm.banManager().kickPlayer( player, reason )
					ctx.write( 'Player %s kicked\n' % playerid )


	def onPlayerSpawn( self, player, soldier ):
		# host.rcon_invoke("sv.spawnTime 0")
		# self.Log(str(bf2.objectManager.getObjectsOfType('dice.hfe.world.ObjectTemplate.ControlPoint')[0].cp_getParam('isHemisphere')), "info")
		# self.Log(str(dir(bf2.objectManager.getObjectsOfType('dice.hfe.world.ObjectTemplate.ControlPoint'))), "info")
		# self.Log("g_controlPoints 0", "info")
		# self.Log(str(dir(bf2)), "info")
		# self.Log(str(dir(bf2.g_controlPoints)), "info")
		# global bf2.g_controlPoints
		# bf2.g_controlPoints 
		# e = bf2.objectManager.getObjectsOfType(
                  # 'dice.hfe.world.ObjectTemplate.ControlPoint').getTemplateProperty('controlPointName'); self.Log(e, "info")
		# for obj in bf2.objectManager.getObjectsOfType(
                  # 'dice.hfe.world.ObjectTemplate.ControlPoint'):
			# if obj.getTemplateProperty('controlPointName') == "CPNAME_SK_16_hotel":
				# e = obj.getTemplateProperty('ObjectTemplate.timeToGetControl');self.Log(str(e), "info")
				# obj.cp_setParam('ObjectTemplate.timeToGetControl', 0)
				# obj.cp_setParam('ObjectTemplate.timeToLoseControl', 0)
				
		"""Kick the player if required."""
		if 1 != self.__state:
			return 0

		# Need to check due to changes
		if not player.mmSpawned:
			player.mmSpawned = True
			# N.B. two part if to ensure config changes work appropriatly
			if self.__config['kickMode'] == KickMode.onSpawn:
				self.__checkPlayer( player )
				
	def onChatMessage(self, playerid, text, channel, flags):
		"""Called whenever a player issues a chat string."""
		if 1 != self.__state:
			return 0

		# server message - channel 'ServerMessage'
		if playerid < 0:
			return
		self.mm.info('player \'%s\' message \'%s\' channel: \'%s\' flags:\'%s\'' % (playerid, text, channel, flags))
		pure_text = mm_utils.MsgChannels.named[channel].stripPrefix(text).lower()
		if pure_text[0] != '/':
			return
		if pure_text == "/ready" or pure_text == '/r':
			self.player_state[playerid].ready = Warmup.PlayerState.READY
			self.checkState()
		elif pure_text == "/notready" or pure_text == '/nr':
			self.player_state[playerid].ready = Warmup.PlayerState.NOT_READY
			self.checkState()
		elif pure_text == "/stream":
			self.player_state[playerid].ready = Warmup.PlayerState.STREAM
			self.checkState()
		elif pure_text == '/mapame':
			self.mm.info('DUMP mapname: \'%s\'' % host.sgl_getMapName())
		elif pure_text == '/pos':
			mm_utils.msg_server(self.dumpPos(playerid))
		elif pure_text == '/setpos':
			self.Log("/setpos 0", "info")
			prefix = "/"
			( cmd, args ) = mm_utils.largs( text[len(prefix):], None, 2, '', True )
			self.Log("/setpos 1", "info")
			self.Log(str(cmd), "info")
			self.Log(str(args), "info")
			self.setPlayerPosition(playerid, (200,100,100))
			# mm_utils.msg_server(self.dumpPos(playerid))
			self.Log("/setpos 2", "info")
		elif pure_text == '/disable':
			self.switchToLive()
			self.module_enabled = False

	def dumpPos(self, playerid):
		try:
			player = bf2.playerManager.getPlayerByIndex(playerid)
			veh = player.getVehicle()
			pos = veh.getPosition()
			rot = veh.getRotation()

			message = 'DUMP pos: \'((%s.0, %s.0, %s.0), (%s.0, %s.0, %s.0))\'' % \
					  (int(pos[0]), int(pos[1]), int(pos[2]), int(rot[0]), int(rot[1]), int(rot[2]))
			self.mm.info(message)
			return message
		except Exception, e:
			self.mm.error('Failed to get player pos', True)
			
	def setPlayerPosition(self, playerid, pos):
		self.Log("setPlayerPosition 0", "info")
		player = mm_utils.find_player(playerid)
		self.Log(str(player), "info")
		if player and player.isAlive():
			self.Log("setPlayerPosition 1", "info")
			playerVehicle = player.getVehicle()
			rootVehicle = bf2.objectManager.getRootParent(playerVehicle)
			# rootVehicle.setPosition(player, (int(pos[0]), int(pos[1]), int(pos[2])))
			rootVehicle.setPosition(player, (1, 1, 1))
		self.Log("setPlayerPosition 2", "info")

	def init( self ):
		"""Provides default initialisation."""

		# Load the configuration
		self.__config = self.mm.getModuleConfig( configDefaults )
		self.__profileIds = dict.fromkeys( self.__config['profileIds'], 1 )
		self.__newPlayers = {}
		self.__reservedPlayers = {}

		if host.ss_getParam('ranked'):
			# Max of 20%
			max_reserved = ( host.ss_getParam( 'maxPlayers' ) * 0.2 )
			if self.__config['reservedSlots'] > max_reserved:
				self.mm.warn( "Max reserved slots is 20%% of maxPlayers on ranked servers, setting to %d" % max_reserved )
				self.__config['reservedSlots'] = max_reserved

		# Register your game handlers and provide any
		# other dynamic initialisation here
		if 0 == self.__state:
			# host.registerHandler( 'PlayerSpawn', self.onPlayerSpawn, 1 )
			host.registerHandler( 'PlayerSpawn', self.onPlayerSpawn, 1 )
			host.registerHandler( 'PlayerConnect', self.onPlayerConnect, 1 )
			host.registerHandler( 'PlayerDisconnect', self.onPlayerDisconnect, 1 )
			host.registerHandler( 'ChatMessage', self.onChatMessage, 1)
		
		host.registerGameStatusHandler( self.onGameStatusChanged )

		# Register our rcon command handlers
		# self.mm.registerRconCmdHandler( 'locker', { 'method': self.cmdExec, 'subcmds': self.__cmds, 'level': 0 } )
		self.mm.registerRconCmdHandler( 'lock', { 'method': self.ManualLock, 'level': 0 } )
		self.mm.registerRconCmdHandler( 'unlock', { 'method': self.ManualUnlock, 'level': 0 } )
		self.mm.registerRconCmdHandler( 'fastkick', { 'method': self.kickPlayer, 'level': 0 } )
		# self.mm.registerRconCmdHandler( 'unlock', { 'method': self.unlockServer, 'level': 0 } )

		# Update to the running state
		self.__state = 1

	def shutdown( self ):
		"""Shutdown and stop processing."""

		# Unregister game handlers and do any other
		# other actions to ensure your module no longer affects
		# the game in anyway
		#self.mm.unregisterRconCmdHandler( 'locker' )
		self.mm.unregisterRconCmdHandler( 'lock' )
		self.mm.unregisterRconCmdHandler( 'unlock' )
		self.mm.unregisterRconCmdHandler( 'fastkick' )

		# Flag as shutdown as there is currently way to:
		# host.unregisterHandler
		self.__state = 2

def mm_load( modManager ):
	"""Creates your object."""
	return Locker( modManager )
