#!/usr/bin/env stack
-- stack --install-ghc runghc --package turtle

{-# LANGUAGE OverloadedStrings #-}

import Turtle
import Control.Concurrent.Async

type PortOffset = Int
type NodeName = Text

-- TODO: Get Infinispan Home from environment variable, e.g. ISPN_HOME or JBOSS_HOME
ispnHome = "/opt/infinispan-server"
ispnSh = "/infinispan-server/bin/standalone.sh"
configDir = "infinispan-server/standalone/configuration"
clusteredStandaloneSh = "/infinispan-server/bin/standalone.sh -c clustered.xml"
sslSh = "/infinispan-server/bin/standalone.sh -c standalone-hotrod-ssl.xml"
portOpts = "-Djboss.socket.binding.port-offset="%d%""
clusterOpts = "-Djboss.node.name="%s%" \
    \-Djboss.socket.binding.port-offset="%d%" \
    \-Djgroups.join_timeout=1000"
addUserSh = ""%fp%"/infinispan-server/bin/add-user.sh -u admin -p 'mypassword'"

mkTmpDir :: Text -> Shell Turtle.FilePath
mkTmpDir s = using (mktempdir "/tmp" s)

cpR :: Text -> Turtle.FilePath -> Text
cpR src dst = format ("cp -r "%s%" "%fp%"") src dst

cpD :: Text -> Turtle.FilePath -> Text
cpD src dst = format ("cp "%s%" "%fp%"") src dst

addUser :: Turtle.FilePath -> Text
addUser path = format (addUserSh) path

exec :: MonadIO io => Text -> io ExitCode
exec cmd = shell cmd empty

asyncExec :: Text -> Shell (Async ExitCode)
asyncExec = using . fork . exec

startServer :: Turtle.FilePath -> Shell (Async ExitCode)
startServer h = asyncExec $ (format fp h) <> ispnSh

startPortOffsetServer :: Turtle.FilePath -> Text -> PortOffset -> Shell (Async ExitCode)
startPortOffsetServer h shCmd p = asyncExec $ (format fp h) <> shCmd <> " " <> (format portOpts p)

startClusterServer :: Turtle.FilePath -> Text -> Shell (Async ExitCode)
startClusterServer h ps = asyncExec $ (format fp h) <> clusteredStandaloneSh <> " " <> ps

launchLocalNode :: Shell (Async ExitCode)
launchLocalNode = do
    dir <- mkTmpDir "local"
    _   <- exec (cpR ispnHome dir)
    _   <- exec (addUser dir)
    startServer dir

mkClusterOpts :: NodeName -> PortOffset -> Text
mkClusterOpts n p = format (clusterOpts) n p

launchClusterNode :: NodeName -> PortOffset -> Shell (Async ExitCode)
launchClusterNode n p = do
    _ <- (sleep 2.0)
    dir <- mkTmpDir "cluster"
    _   <- exec (cpR ispnHome dir)
    _   <- exec (addUser dir)
    startClusterServer dir (mkClusterOpts n p)

launchSslNode :: PortOffset -> Shell (Async ExitCode)
launchSslNode p = do
    _ <- (sleep 2.0)
    dir <- mkTmpDir "ssl"
    _   <- exec (cpR ispnHome dir)
    _   <- exec (cpD "spec/configs/standalone-hotrod-ssl.xml" (dir <> configDir))
    _   <- exec (cpD "spec/ssl/auth/server/keystore_server.jks" (dir <> configDir))
    _   <- exec (cpD "spec/ssl/auth/server/truststore_server.jks" (dir <> configDir))
    _   <- exec (cpD "spec/ssl/sni/trusted/server/keystore_trusted_server.jks" (dir <> configDir))
    _   <- exec (cpD "spec/ssl/sni/trusted/server/keystore_trusted1.acme_server.jks" (dir <> configDir))
    _   <- exec (cpD "spec/ssl/sni/untrusted/server/keystore_untrusted_server.jks" (dir <> configDir))
    _   <- exec (addUser dir)
    startPortOffsetServer dir sslSh p

main = sh (do
    local      <- launchLocalNode
    cluster1   <- launchClusterNode "node1" 100 -- 11322
    cluster2   <- launchClusterNode "node2" 110 -- 11332
    cluster3   <- launchClusterNode "node3" 120 -- 11342
    ssl        <- launchSslNode 200
    -- TODO: Check that cluster forms
    _ <- liftIO (wait local)
    _ <- liftIO (wait cluster1)
    _ <- liftIO (wait cluster2)
    _ <- liftIO (wait cluster3)
    liftIO (wait ssl)
    )
