# vim: ts=4 sw=4 noexpandtab
"""Sample module.

This is a Sample ModManager module

===== Config =====
 # Sets option 1
 mm_sample.myOption1 1
 
 # Sets option 2
 mm_sample.myOption2 "hello there"

===== History =====
 v1.3 - 30/08/2006:
 Added supported games

 v1.2 - 13/08/2005:
 Added missing mm.unregisterRconCmdHandler to shutdown
 
 v1.1 - 29/07/2005:
 Updated API definition
 
 v1.0 - 01/07/2005:
 Initial version

Copyright (c)2005 Multiplay
Author: Steven 'Killing' Hartland
"""

import bf2
import host
import mm_utils

# Set the version of your module here
__version__ = 0.5

# Set the required module versions here
__required_modules__ = {
    'modmanager': 1.6
}

# Does this module support reload ( are all its reference closed on shutdown? )
__supports_reload__ = True

# Sets which games this module supports
__supported_games__ = {
    'bf2': True,
    'bf2142': True
}

# Set the description of your module here
__description__ = "Reserve Slots Keyhash v%s" % __version__

class KickMode:
    onSpawn = 1
    onConnect = 2

# Add all your configuration options here
configDefaults = {
    'kickDelay': 5,
    'kickMode': KickMode.onSpawn,
    'kickType': mm_utils.KickBanType.rcon,
    'kickReason': "Join us on discord.gg/bf2pb",
    'profileIds': [],
    'scriptName' : 'Doc & sirSolarius Kicker v1.7',
    'fileName' : 'knownkeys.txt',
    'knownKeys' : [],
    'mode' : 0
}

class KeyhashLocker( object ):

    def __init__( self, modManager ):
        # ModManager reference
        self.mm = modManager

        # Internal shutdown state
        self.__state = 0

        # Add any static initialisation here.
        # Note: Handler registration should not be done here
        # but instead in the init() method

        # Your rcon commands go here:
        self.__cmds = {
            'addPlayer': { 'method': self.addPlayerToList, 'args': '<playername>', 'level': 10 },
            'addPlayerById': { 'method': self.addPlayerToListById, 'args': '<player id>', 'level': 10 },
            'addKeyhash': { 'method': self.addKeyhashToList, 'args': '<keyhash>', 'level': 10 },
            'removePlayer': { 'method': self.removePlayerFromList, 'args': '<player name>', 'level': 10 },
            'removeKeyhash': { 'method': self.removePlayerFromListByHash, 'args': '<keyhash>', 'level': 10 },
            'changeMode': { 'method': self.changeMode, 'args': '[private|semiprivate|public]', 'level': 10 },
            'currentMode': { 'method': self.writeMode, 'level': 10 },
            'numFromList': { 'method': self.writeNumList, 'level': 10 },
            'isOnList': { 'method': self.isOnList, 'level': 10 }
        }
#             self.__cmds = {
#             'addPlayer': { 'method': self.rcmd_addPlayer, 'level': 10 },
#             'removePlayer': { 'method': self.rcmd_removePlayer, 'level': 10 },
#             'changeMode': { 'method': self.rcmd_changeMode, 'level': 10 },
#             'currentMode': { 'method': self.rcmd_currMode, 'level': 10 },
#             'numFromList': { 'method': self.rcmd_numFromList, 'level': 10 },
#             'isOnList': { 'method': self.rcmd_isOnList, 'level': 10 }
#         }
        global scriptName, fileName, knownKeys, mode
        scriptName = None
        fileName = None
        knownKeys = None
        mode = None
        
    def loadKeys(self):
        
        global knownKeys, fileName
        fileName = self.fileName
#         knownKeys = self.knownKeys
        keysFile = open(fileName, 'a+')
        keysFile.close()
        keysFile = open(fileName, 'r')
        for key in keysFile:
            knownKeys.append(key.rstrip())
        keysFile.close()
        print knownKeys

 
#     def onPlayerSpawn2(self, player):
#         self.Log("onPlayerSpawn 1", "info")
#     def onPlayerSpawn(self, player, soldier):
#         pass
    def onPlayerConnect(self, player):
        global knownKeys, mode, scriptName
        self.Log("onPlayerSpawn 0", "info")
        # private
        if mode == 0:
            playerKey = mm_utils.get_cd_key_hash(player)
            if playerKey not in knownKeys:
#                 host.rcon_invoke('game.sayAll "%s: Player with key %s was not on the list!"' % (scriptName, playerKey))
                host.rcon_invoke('game.sayAll "%s: Player %s was not on the list!"' % (scriptName, player.getName()))
                host.rcon_invoke('admin.kickPlayer %d' % player.index)
#                 self.mm.banManager().kickPlayer(player, self.__config['kickReason'], self.__config['kickDelay'], self.__config['kickType'])
#                 host.rcon_invoke( 'exec pb_sv_kick %s 0 %s' % (player.index, self.__config['kickReason']) )
#                 host.rcon_invoke( 'pb_sv_kick %s 0 %s' % (player.getName(), self.__config['kickReason']) )
#                 host.rcon_invoke( 'pb_sv_kick rkantos 0 %s' % self.__config['kickReason'] )
#                 host.rcon_invoke( 'pb_sv_kick rkantos 0 test' )
#                 self.Log("pb kick??", "info")
    
        # semiprivate
        elif mode == 1:
            # if we're at capacity (new person fills our extra spot)
            if bf2.playerManager.getNumberOfPlayers() == bf2.serverSettings.getMaxPlayers():
                playerKey = mm_utils.get_cd_key_hash(player)
                # if he's not on the list, put him back where he came from
                if playerKey not in knownKeys:
                    host.rcon_invoke('game.sayAll "%s: Player with key %s kicked: no room for people off the list!"' % (scriptName, playerKey))
                    self.mm.banManager().kickPlayer(player, self.__config['kickReason'], self.__config['kickDelay'], self.__config['kickType'])
                    return
                # he's on the list: kick someone who isn't
                else:
                    currPlayers = bf2.playerManager.getPlayers()
                    foundCommander = 0
                    commander = player
                    for p in currPlayers:
                        # if we found someone to toss out
                        pKey = mm_utils.get_cd_key_hash(p)
                        if pKey not in knownKeys:
                            # if he's the commander, try to find someone else
                            if p.isCommander():
                                commander = p
                                foundCommander = 1
                            else:
                                host.rcon_invoke('game.sayAll "%s: Player with key %s kicked for %s"' % (scriptName, pKey, playerKey))
                                host.rcon_invoke('admin.kickPlayer %d' % p.index)
                                return
                    # if we checked everyone and only the commander remains... bye-bye
                    if foundCommander == 1:
                        commanderKey = mm_utils.get_cd_key_hash(commander)
                        host.rcon_invoke('game.sayAll "%s: Player with key %s kicked for %s"' % (scriptName, commanderKey, playerKey))
                        host.rcon_invoke('admin.kickPlayer %d' % commander.index)
                    else:
                        # no one to kick =(
                        # host.rcon_invoke('game.sayAll "%s: Player with key %s kicked: no room even for people on the list!"' % (scriptName, playerKey))
                        # host.rcon_invoke('admin.kickPlayer %d' % player.index)
                        return

    
    # Other functions remain unchanged
    
    def changeMode(self, ctx, m):
        """Change the keyhashlocker mode"""
        global mode, knownKeys, scriptName
        if m == 'private':
            host.rcon_invoke('game.sayAll "' + scriptName + ': Changing to private mode.  Flushing the undesirables!"')
            currPlayers = bf2.playerManager.getPlayers()
            for p in currPlayers:
                pKey = mm_utils.get_cd_key_hash(p)
                if not pKey in knownKeys:
                    host.rcon_invoke('admin.kickPlayer ' + str(p.index))
                   
            mode = 0
        elif m == 'semiprivate':
            host.rcon_invoke('game.sayAll "' + scriptName + ': Changing to semiprivate mode.  Bring on some asshats!"')
            mode = 1
        else:
            host.rcon_invoke('game.sayAll "' + scriptName + ': Changing to public mode.  Bring on the asshats!"')
            mode = 2
    
    def addPlayerToList(self, ctx, player):
        """Add player to list by name (WIP)"""
        global fileName, knownKeys
        key = mm_utils.get_cd_key_hash(player)
        if key in knownKeys:
            print 'Key already in list!'
            return
        keysFile = open(fileName, 'a')
        keysFile.write(key + '\n')
        knownKeys.append(key)
        print 'Key added to list.'

    def addPlayerToListById(self, ctx, player_id):
        """Add player to list by player id (WIP)"""
        global fileName, knownKeys
        player = bf2.playerManager.getPlayerByIndex(player_id)
        key = mm_utils.get_cd_key_hash(player)
        if key in knownKeys:
            print 'Key already in list!'
            return
        keysFile = open(fileName, 'a')
        keysFile.write(key + '\n')
        knownKeys.append(key)
        print 'Key added to list.'
        
    def addKeyhashToList(self, ctx, keyHash):
        """Add player to list by name keyhash"""
        global fileName, knownKeys
        key = keyHash
        if key in knownKeys:
            print 'Key already in list!'
            return
        keysFile = open(fileName, 'a')
        keysFile.write(key + '\n')
        knownKeys.append(key)
        print 'Key added to list.'
    
    def writeMode(self, ctx, cmd):
        """Shows the current keyhashlocker mode"""
        global mode
        if mode == 0:
            ctx.write('The current mode is private.')
        elif mode == 1:
            ctx.write('The current mode is semiprivate.')
        else:
            ctx.write('The current mode is public.')
    
    def writeNumList(self, ctx):
        """Shows the number of players on server from keylist"""
        global knownKeys
        playerCount = 0
        currPlayers = bf2.playerManager.getPlayers()
        for p in currPlayers:
            pKey = mm_utils.get_cd_key_hash(p)
            if pKey in knownKeys:
                playerCount += 1       
        ctx.write('There are %i players from the list online.' % (playerCount))
    
#     def isOnList(self, player, ctx):
    def isOnList(self, ctx, keyHash):
        """Checks if a keyhash is on the keylist"""
        global knownKeys
        playerKey = keyHash
        if playerKey in knownKeys:
            ctx.write('Player with key %s is registered on the list.' % playerKey)
        else:
            ctx.write('Player with key %s is *not* on the list.  Do what you must with him.' % playerKey)
    
    def removePlayerFromList(self, ctx, player):
        """Removes a player from the keylist by partial name (WIP)"""
        global fileName, knownKeys
        playerKey = mm_utils.get_cd_key_hash(player)
        if not playerKey in knownKeys:
            return
        knownKeys.remove(playerKey)
        keysFile = open(fileName, 'w')
        keysFile.truncate(0)
        for key in knownKeys:
            keysFile.write(key + '\n')
        keysFile.close()
        
    def removePlayerFromListByHash(self, ctx, keyHash):
        """Removes a player from the keylist by keyHash"""
        global fileName, knownKeys
        playerKey = mm_utils.get_cd_key_hash(player)
        if not playerKey in knownKeys:
            return
        knownKeys.remove(playerKey)
        keysFile = open(fileName, 'w')
        keysFile.truncate(0)
        for key in knownKeys:
            keysFile.write(key + '\n')
        keysFile.close()


    def cmdExec( self, ctx, cmd ):
        """Execute a MyModule sub command."""

        # Note: The Python doc above is used for help / description
        # messages in rcon if not overriden
        return mm_utils.exec_subcmd( self.mm, self.__cmds, ctx, cmd )

    def cmdSample( self, ctx, cmd ):
        """Does XYZ.
        Details about this function
        """
        # Note: The Python doc above is used for help / description
        # messages in rcon if not overriden
        self.mm.debug( 2, "Running cmdSample '%s'" % cmd )
        ctx.write( "Your arguments where '%s'" % cmd )
        return 1

#     def onPlayerSpawn( self, player, soldier ):
#         """Do something when a player spawns."""
#         if 1 != self.__state:
#             return 0

        # Put your actions here

    def init( self ):
        """Provides default initialisation."""

        # Load the configuration
        self.__config = self.mm.getModuleConfig( configDefaults )
        self.fileName = self.__config['fileName']
        self.knownKeys = self.__config['knownKeys']
        
        global scriptName, fileName, knownKeys, mode
        scriptName = self.__config['scriptName']
        fileName = self.__config['fileName']
        knownKeys = self.__config['knownKeys']
        mode = self.__config['mode']
        
        self.loadKeys()

        # Register your game handlers and provide any
        # other dynamic initialisation here

        if 0 == self.__state:
            # Register your host handlers here
            host.registerHandler( 'PlayerSpawn', self.onPlayerSpawn, 1 )
            host.registerHandler( 'PlayerConnect', self.onPlayerConnect, 1)

        # Register our rcon command handlers
        self.mm.registerRconCmdHandler( 'keyhashlocker', { 'method': self.cmdExec, 'subcmds': self.__cmds, 'level': 1 } )

        # Update to the running state
        self.__state = 1

    def shutdown( self ):
        """Shutdown and stop processing."""

        # Unregister game handlers and do any other
        # other actions to ensure your module no longer affects
        # the game in anyway
        self.mm.unregisterRconCmdHandler( 'PlayerSpawn' )
        self.mm.unregisterRconCmdHandler( 'PlayerConnect' )

        # Flag as shutdown as there is currently way to:
        # host.unregisterHandler
        self.__state = 2

    def update( self ):
        """Process and update.
        Note: This is called VERY often processing in here should
        be kept to an absolute minimum.
        """
        pass
    
    def Log( self, e, error_level ):
        try:
            e = str(e)
        except Exception, e:
            self.mm.error(str("error with error format") + str(e))
            # self.mm.error(str(e))

        if error_level == "info":
            mm_utils.msg_server( e )
            host.rcon_invoke( e )
            self.mm.info( e )
        elif error_level == "serverinfo":
            self.mm.info( e )
        else:
            self.mm.error( e )    

def mm_load( modManager ):
    """Creates and returns your object."""
    return KeyhashLocker( modManager )
